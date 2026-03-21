<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class TicketReply extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'ticket_id', 'message', 'sender_type', 'sender_name',
    ];

    public function ticket()
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }
}
