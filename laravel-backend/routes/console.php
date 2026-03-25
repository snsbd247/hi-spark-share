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
