<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'ticket_id', 'customer_id', 'subject', 'category',
        'priority', 'status', 'assigned_to',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function replies()
    {
        return $this->hasMany(TicketReply::class, 'ticket_id');
    }
}
