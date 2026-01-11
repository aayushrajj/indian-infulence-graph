import React, { useState } from 'react';
import MemeView from './MemeView';
import ProfessionalView from './ProfessionalView';

const MainApp = () => {
    const [viewMode, setViewMode] = useState('meme'); // 'meme' or 'professional'

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* Toggle Control */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '10px 15px',
                borderRadius: '25px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                border: '2px solid rgba(255, 255, 255, 0.2)'
            }}>
                <button
                    onClick={() => setViewMode('meme')}
                    style={{
                        background: viewMode === 'meme' ? '#FF9800' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'meme' ? 'bold' : 'normal',
                        transition: 'all 0.3s ease',
                        fontSize: '14px'
                    }}
                >
                    🎭 Meme View (3D)
                </button>
                <button
                    onClick={() => setViewMode('professional')}
                    style={{
                        background: viewMode === 'professional' ? '#2196F3' : 'transparent',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'professional' ? 'bold' : 'normal',
                        transition: 'all 0.3s ease',
                        fontSize: '14px'
                    }}
                >
                    💼 Professional View (2D)
                </button>
            </div>

            {/* Render appropriate view */}
            {viewMode === 'meme' ? (
                <MemeView />
            ) : (
                <ProfessionalView />
            )}
        </div>
    );
};

export default MainApp;
