<?php
declare(strict_types=1);
namespace InvoiceTests;
use Invoice\Invoice;
use PHPUnit\Framework\TestCase;
final class InvoiceTest extends TestCase {
    public function testQuantities(): void { self::assertSame(73,(new Invoice())->total([['price'=>17,'quantity'=>3],['price'=>11,'quantity'=>2],['price'=>100,'quantity'=>0]])); }
    public function testEmptyInvoice(): void { self::assertSame(0,(new Invoice())->total([])); }
    public function testZeroQuantity(): void { self::assertSame(0,(new Invoice())->total([['price'=>100,'quantity'=>0]])); }
}
