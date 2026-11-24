import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Pay from './pages/Pay';
import Order from './pages/Order';
import Profile from './pages/Profile';
import Courier from './pages/Courier';
import NotFound from './pages/NotFound';
import { Login, Register } from './pages/Auth';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminOrders from './pages/admin/Orders';
import AdminProducts from './pages/admin/Products';
import AdminCategories from './pages/admin/Categories';
import AdminPromotions from './pages/admin/Promotions';
import AdminUsers from './pages/admin/Users';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
        <Route path="/pay/:id" element={<Pay />} />
        <Route path="/orders/:id" element={<Protected><Order /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/courier" element={<Protected roles={['courier']}><Courier /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin']}><AdminLayout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="promotions" element={<AdminPromotions />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
