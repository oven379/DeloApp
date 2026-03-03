<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

/*
 * Синхронизация задач (будущее расширение).
 * Пример маршрутов после добавления авторизации и контроллера:
 *
 * Route::get('/tasks', [TasksController::class, 'index'])->middleware('auth:sanctum');
 * Route::post('/tasks', [TasksController::class, 'store'])->middleware('auth:sanctum');
 *
 * Формат: JSON с массивом задач, как в frontend (id, text, createdAt, forDay, completedAt, order, reminderAt, ...).
 */
