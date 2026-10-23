import unittest
from invoice import invoice_total


class InvoiceTests(unittest.TestCase):
    def test_quantity_and_zero(self):
        self.assertEqual(invoice_total([
            {"price": 17, "quantity": 3},
            {"price": 8, "quantity": 0},
            {"price": 11, "quantity": 2},
        ]), 73)

    def test_empty(self):
        self.assertEqual(invoice_total([]), 0)

    def test_fractional(self):
        self.assertEqual(invoice_total([{"price": 2.5, "quantity": 4}]), 10)
