// Temporary test component to verify cover system works
import React from 'react';

export const TestCover: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('🧪 TestCover is rendering!');
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Test overlay that should ALWAYS show */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'red',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '48px',
        fontWeight: 'bold'
      }}>
        TEST COVER IS WORKING!
        <div style={{ position: 'absolute', bottom: '50px', fontSize: '16px' }}>
          If you see this red screen, the cover system works.
        </div>
      </div>
      {children}
    </div>
  );
};

