def invoice_total(lines):
    return sum(line["price"] * line["quantity"] for line in lines)
