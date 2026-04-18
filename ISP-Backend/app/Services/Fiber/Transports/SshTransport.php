<?php

namespace App\Services\Fiber\Transports;

/**
 * Lightweight SSH transport.
 *
 * Strategy:
 *   1. If `ext-ssh2` is loaded → use native SSH2.
 *   2. Else, fall back to `sshpass + ssh` shell (requires sshpass on the host).
 *   3. If neither available → return graceful failure (no exception bubble).
 *
 * Credentials are NEVER logged. Output is truncated by caller.
 */
class SshTransport
{
    /**
     * @return array{ ok:bool, output:string, error?:string }
     */
    public function exec(string $host, int $port, string $username, string $password, string $command, int $timeoutSec = 15): array
    {
        if (function_exists('ssh2_connect')) {
            return $this->execNative($host, $port, $username, $password, $command, $timeoutSec);
        }
        if ($this->hasSshpass()) {
            return $this->execShell($host, $port, $username, $password, $command, $timeoutSec);
        }
        return [
            'ok' => false,
            'output' => '',
            'error' => 'No SSH transport available (install php-ssh2 or sshpass).',
        ];
    }

    private function execNative(string $host, int $port, string $user, string $pass, string $cmd, int $timeout): array
    {
        try {
            $conn = @ssh2_connect($host, $port);
            if (!$conn) return ['ok' => false, 'output' => '', 'error' => 'connect failed'];
            if (!@ssh2_auth_password($conn, $user, $pass)) {
                return ['ok' => false, 'output' => '', 'error' => 'auth failed'];
            }
            $shell = @ssh2_shell($conn, 'xterm');
            if (!$shell) return ['ok' => false, 'output' => '', 'error' => 'shell open failed'];
            stream_set_blocking($shell, true);
            stream_set_timeout($shell, $timeout);
            fwrite($shell, $cmd . "\n");
            $out = '';
            $start = time();
            while (!feof($shell) && (time() - $start) < $timeout) {
                $chunk = fread($shell, 8192);
                if ($chunk === false || $chunk === '') break;
                $out .= $chunk;
                if (strlen($out) > 200000) break;
            }
            @fclose($shell);
            return ['ok' => true, 'output' => $out];
        } catch (\Throwable $e) {
            return ['ok' => false, 'output' => '', 'error' => $e->getMessage()];
        }
    }

    private function execShell(string $host, int $port, string $user, string $pass, string $cmd, int $timeout): array
    {
        $passEsc = escapeshellarg($pass);
        $userEsc = escapeshellarg($user . '@' . $host);
        $cmdEsc = escapeshellarg($cmd);
        $sshOpts = '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=' . max(3, (int)($timeout / 2));
        $full = "timeout {$timeout} sshpass -p {$passEsc} ssh {$sshOpts} -p {$port} {$userEsc} {$cmdEsc} 2>&1";
        $output = @shell_exec($full);
        if ($output === null) {
            return ['ok' => false, 'output' => '', 'error' => 'exec failed'];
        }
        return ['ok' => true, 'output' => $output];
    }

    private function hasSshpass(): bool
    {
        $check = @shell_exec('command -v sshpass 2>/dev/null');
        return is_string($check) && trim($check) !== '';
    }
}
