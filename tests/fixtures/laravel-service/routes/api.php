<?php
use Illuminate\Support\Facades\Route;
Route::get('/orders',static fn()=>response()->json(['total'=>(new Invoice\Invoice())->total([['price'=>17,'quantity'=>3],['price'=>11,'quantity'=>2],['price'=>100,'quantity'=>0]]),'configured'=>getenv('APP_LABEL')!==false]));
