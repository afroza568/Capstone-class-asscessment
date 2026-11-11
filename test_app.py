import unittest
import json
import os
from app import app, load_db

class GrillRestaurantTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_01_get_menu(self):
        res = self.app.get('/api/menu')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertGreater(len(data['data']), 0)
        print(f"✓ Menu loaded successfully ({len(data['data'])} dishes found)")

    def test_02_category_filter(self):
        res = self.app.get('/api/menu?category=Pizza')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        for item in data['data']:
            self.assertEqual(item['category'], 'Pizza')
        print(f"✓ Category filter verified ({len(data['data'])} pizza dishes)")

    def test_03_search_menu(self):
        res = self.app.get('/api/menu?search=onion')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertGreater(len(data['data']), 0)
        self.assertIn("Onion", data['data'][0]['name'])
        print(f"✓ Search verified (Found: {data['data'][0]['name']})")

    def test_04_coupon_apply(self):
        res = self.app.post('/api/coupons/apply', json={"code": "WELCOME", "subtotal": 100.0})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['discount'], 3.0)
        print("✓ Discount coupon verified (WELCOME gave $3.00 off)")

    def test_05_place_order_and_track(self):
        payload = {
            "customer_name": "Test Customer",
            "order_type": "Dine In",
            "payment_method": "Cash",
            "items": [
                {"id": 1, "name": "Onion Pizza", "price": 60.0, "quantity": 1, "variant": "Regular"}
            ],
            "coupon_code": "WELCOME"
        }
        res = self.app.post('/api/orders', json=payload)
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        order_id = data['data']['id']
        print(f"✓ Order placed successfully (ID: {order_id}, Total: ${data['data']['total']})")

        # Track order
        track_res = self.app.get(f'/api/orders/{order_id}')
        self.assertEqual(track_res.status_code, 200)
        track_data = json.loads(track_res.data)
        self.assertEqual(track_data['data']['status'], "Preparing")
        print(f"✓ Order tracking verified (Status: {track_data['data']['status']})")

        # Update status
        status_res = self.app.patch(f'/api/orders/{order_id}/status', json={"status": "Ready"})
        self.assertEqual(status_res.status_code, 200)
        status_data = json.loads(status_res.data)
        self.assertEqual(status_data['data']['status'], "Ready")
        print("✓ Order status update verified")

    def test_06_admin_dish_management(self):
        new_dish = {
            "name": "Spicy BBQ Wings",
            "category": "Fast Food",
            "price": 32.50,
            "description": "Crispy chicken wings tossed in smoked BBQ glaze",
            "rating": 4.8
        }
        res = self.app.post('/api/menu', json=new_dish)
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        dish_id = data['data']['id']
        print(f"✓ Admin: Added new dish (ID: {dish_id})")

        # Delete dish
        del_res = self.app.delete(f'/api/menu/{dish_id}')
        self.assertEqual(del_res.status_code, 200)
        print("✓ Admin: Deleted dish successfully")

    def test_07_daily_sales_report(self):
        res = self.app.get('/api/reports/daily')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertIn('total_revenue_all_time', data)
        self.assertIn('order_types', data)
        print(f"✓ Daily sales report verified (Total revenue: ${data['total_revenue_all_time']})")

    def test_08_recommendations(self):
        # Pass Onion Pizza (ID 1), expect complementary items
        res = self.app.get('/api/recommendations?cart=1')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertGreater(len(data['recommendations']), 0)
        print(f"✓ Recommendations verified (Suggested: {[r['name'] for r in data['recommendations']]})")

if __name__ == '__main__':
    unittest.main()
