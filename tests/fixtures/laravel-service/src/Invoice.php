<?php
declare(strict_types=1);
namespace Invoice;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
final class Invoice {
    public function __construct(private LoggerInterface $logger = new NullLogger()) {}
    public function total(array $lines): int {
        $total=0;
        foreach($lines as $line) $total += $line['price'] * $line['quantity'];
        $this->logger->info('invoice calculated', ['lines'=>count($lines)]);
        return $total;
    }
}
