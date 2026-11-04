public static class Invoice
{
    public static decimal Total(params (decimal Price, int Quantity)[] lines)
        => lines.Sum(line => line.Price * line.Quantity);
}
