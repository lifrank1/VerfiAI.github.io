import React, { createContext, useState, useContext } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userID, setUserID] = useState(null); // Store the userID

  const login = (id) => {
    setIsLoggedIn(true);
    setUserID(id); // Store the userID on login
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserID(null); // Clear the userID on logout
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userID, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use authentication context
export const useAuth = () => {
  return useContext(AuthContext);
};
