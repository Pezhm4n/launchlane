def total(lines):
    return sum(line["price"] * line["quantity"] for line in lines)
