import { createSlice } from '@reduxjs/toolkit';

const getCartFromStorage = () => {
  try {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : { items: [], total: 0 };
  } catch (error) {
    return { items: [], total: 0 };
  }
};

const saveCartToStorage = (cart) => {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
};

const calculateTotal = (items) => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: getCartFromStorage(),
  reducers: {
    addToCart: (state, action) => {
      const { product, quantity = 1 } = action.payload;
      const existingItem = state.items.find(item => item._id === product._id);
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        state.items.push({
          _id: product._id,
          name: product.name,
          price: product.price,
          image: product.images[0]?.url || '',
          quantity,
          stock: product.stock,
        });
      }
      
      state.total = calculateTotal(state.items);
      saveCartToStorage(state);
    },
    
    removeFromCart: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter(item => item._id !== productId);
      state.total = calculateTotal(state.items);
      saveCartToStorage(state);
    },
    
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find(item => item._id === productId);
      
      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter(item => item._id !== productId);
        } else {
          item.quantity = Math.min(quantity, item.stock);
        }
        state.total = calculateTotal(state.items);
        saveCartToStorage(state);
      }
    },
    
    clearCart: (state) => {
      state.items = [];
      state.total = 0;
      saveCartToStorage(state);
    },
    
    loadCart: (state, action) => {
      state.items = action.payload.items || [];
      state.total = action.payload.total || 0;
    },
  },
});

export const { 
  addToCart, 
  removeFromCart, 
  updateQuantity, 
  clearCart, 
  loadCart 
} = cartSlice.actions;

export default cartSlice.reducer; 