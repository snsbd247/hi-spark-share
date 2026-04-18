<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// ── ISP Billing ──────────────────────────────────
Schedule::command('bills:generate')->monthlyOn(1, '00:00');
Schedule::command('customers:auto-suspend --days=7')->dailyAt('02:00');

// ── Sessions ─────────────────────────────────────
Schedule::command('sessions:cleanup')->hourly();

// ── Accounting / Reports ─────────────────────────
Schedule::command('reports:daily-profit')->dailyAt('23:55');

// ── Fiber Live OLT Monitoring (adaptive: each OLT honors its own poll_interval_sec)
Schedule::command('fiber:poll-olts')->everyMinute()->withoutOverlapping(5)->runInBackground();

// ── Fiber Signal History Retention (Phase 9) ─────
Schedule::command("fiber:prune-signal-history --days=30")->dailyAt("03:30");

