<?php
declare(strict_types=1);
return Illuminate\Foundation\Application::configure(basePath:dirname(__DIR__))
    ->withRouting(api:__DIR__.'/../routes/api.php')
    ->withMiddleware(function(Illuminate\Foundation\Configuration\Middleware $middleware):void {})
    ->withExceptions(function(Illuminate\Foundation\Configuration\Exceptions $exceptions):void {})
    ->create();
