import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';

/**
 * 登入頁面
 */
export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl p-6 bg-white shadow-lg rounded-xl relative">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-pattern"></div>
        <div className="absolute w-1/2 h-1/2 border-r-2 border-t-2 border-tech-700 opacity-10 rounded-tr-3xl right-0 top-1/4"></div>
        <div className="absolute w-1/4 h-1/4 border-l-2 border-b-2 border-tech-700 opacity-10 rounded-bl-3xl left-1/4 bottom-1/4"></div>
        
        <div className="flex items-center justify-center flex-col max-w-md mx-auto">
          <LoginForm />
          
          <div className="mt-8 relative z-10">
            <div className="h-0.5 w-32 bg-gradient-to-r from-tech-500 via-tech-700 to-tech-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 