import unittest
from invoice import total
class InvoiceTests(unittest.TestCase):
    def test_quantity(self):
        self.assertEqual(total([{"price":17,"quantity":3},{"price":8,"quantity":0},{"price":11,"quantity":2}]),73)
        self.assertEqual(total([]),0)
        self.assertEqual(total([{"price":2.5,"quantity":4}]),10)
