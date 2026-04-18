import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (test) => {
    setCartItems(prev => {
      if (prev.find(i => i.id === test.id)) return prev;
      return [...prev, test];
    });
  };

  const removeFromCart = (testId) => {
    setCartItems(prev => prev.filter(i => i.id !== testId));
  };

  const clearCart = () => setCartItems([]);

  const isInCart = (testId) => cartItems.some(i => i.id === testId);

  const totalAmount = cartItems.reduce((sum, item) => sum + parseFloat(item.base_price || 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, isInCart, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
