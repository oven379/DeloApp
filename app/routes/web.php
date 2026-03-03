<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'DeloApp',
        'message' => 'API is running. Use /api for API routes.',
    ]);
});
