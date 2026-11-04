if (Invoice.Total((17m, 3), (8m, 0), (11m, 2)) != 73m) throw new Exception("Order quantities");
if (Invoice.Total() != 0m) throw new Exception("Empty order");
if (Invoice.Total((2.5m, 4)) != 10m) throw new Exception("Fractional price");
Console.WriteLine("Invoice checks passed");
