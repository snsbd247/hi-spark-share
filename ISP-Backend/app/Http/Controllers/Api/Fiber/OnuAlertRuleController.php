<?php

namespace App\Http\Controllers\Api\Fiber;

use App\Http\Controllers\Controller;
use App\Models\OnuAlertLog;
use App\Models\OnuAlertRule;
use Illuminate\Http\Request;

/**
 * Phase 10 — Alert rules CRUD + logs.
 */
class OnuAlertRuleController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $rows = OnuAlertRule::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->orderByDesc('created_at')
            ->get();
        return response()->json($rows);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $data['tenant_id'] = $this->tenantId($request);
        $rule = OnuAlertRule::create($data);
        return response()->json($rule, 201);
    }

    public function update(Request $request, string $id)
    {
        $tenantId = $this->tenantId($request);
        $rule = OnuAlertRule::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($id);
        $rule->update($this->validatePayload($request, false));
        return response()->json($rule);
    }

    public function destroy(Request $request, string $id)
    {
        $tenantId = $this->tenantId($request);
        OnuAlertRule::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->where('id', $id)
            ->delete();
        return response()->json(['success' => true]);
    }

    public function logs(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $rows = OnuAlertLog::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->when($request->query('serial'), fn($q, $s) => $q->where('serial_number', $s))
            ->when($request->query('event'), fn($q, $e) => $q->where('event_type', $e))
            ->orderByDesc('sent_at')
            ->limit(500)
            ->get();
        return response()->json($rows);
    }

    private function validatePayload(Request $r, bool $required = true): array
    {
        $rule = $required ? 'required' : 'sometimes';
        $data = $r->validate([
            'name' => "$rule|string|max:255",
            'event_type' => "$rule|in:offline,los,dying_gasp,signal_low,any",
            'rx_threshold_db' => 'nullable|numeric',
            'cooldown_minutes' => 'nullable|integer|min:1|max:10080',
            'recipients_email' => 'nullable|array',
            'recipients_email.*' => 'email',
            'recipients_sms' => 'nullable|array',
            'recipients_sms.*' => 'string|max:32',
            'channels' => 'nullable|array',
            'channels.*' => 'in:email,sms',
            'is_active' => 'nullable|boolean',
        ]);
        return $data;
    }

    private function tenantId(Request $r): ?string
    {
        return $r->user()->tenant_id ?? null;
    }
}
