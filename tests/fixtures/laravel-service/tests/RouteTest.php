<?php
declare(strict_types=1);
final class RouteTest extends Illuminate\Foundation\Testing\TestCase {
    public function createApplication(): Illuminate\Foundation\Application {
        $app=require __DIR__.'/../bootstrap/app.php';
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        return $app;
    }
    public function testOriginalFrameworkRoute():void {
        $response=$this->getJson('/api/orders');
        self::assertSame(200,$response->getStatusCode());
        self::assertSame(73,$response->json('total'));
    }
}
