<?php
declare(strict_types=1);
require __DIR__.'/../vendor/autoload.php';
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/api/orders') {
    header('Content-Type: application/json');
    echo json_encode(['total'=>(new Invoice\Invoice())->total([['price'=>17,'quantity'=>3],['price'=>11,'quantity'=>2],['price'=>100,'quantity'=>0]]),'configured'=>getenv('APP_LABEL')!==false]);
    exit;
}
if($path!=='/'&&$path!=='/orders-view'){http_response_code(404);echo 'Missing route';exit;}
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="en"><head><meta charset="utf-8"><title>PHP invoice</title></head><body><h1>Invoice</h1><button type="button">Load orders</button><p id="total" aria-live="polite"></p><script src="/app.js" defer></script></body></html>
