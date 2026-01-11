import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Group colors configuration
const GROUP_COLORS = {
    govt: '#FF9933',
    opposition: '#00FF00',
    business: '#00BFFF',
    party: '#FFF',
    bureaucrat: '#9C27B0',
    ally: '#FFC107',
    ideology: '#795548',
    sports: '#E91E63',
    default: '#ccc'
};

    // We can just alias it to graphData to minimize changes, 
    // or destructure directly. Let's alias.
const ProfessionalView = ({ data, loading, legend }) => {
    const graphData = data || { nodes: [], links: [] };
    const selectedNodeState = useState(null);
    const [selectedNode, setSelectedNode] = selectedNodeState; 
    
    // Alias prop to local variable name used in JSX
    const connectionLegend = legend || [];

    if (loading) {
        return <div className="loading-container">Loading Professional View...</div>;
    }

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
            overflow: 'auto',
            padding: '20px'
        }}>
            {/* Header */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto 40px auto'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '30px',
                    borderRadius: '15px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    marginBottom: '30px'
                }}>
                    <h1 style={{
                        margin: '0 0 10px 0',
                        fontSize: '2.5rem',
                        fontWeight: '700',
                        color: '#1e3c72',
                        textAlign: 'center'
                    }}>
                        Indian Power Network Analysis
                    </h1>
                    <p style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        color: '#666',
                        textAlign: 'center',
                        fontWeight: '400'
                    }}>
                        Professional Overview of India's Top 20 Most Influential Leaders
                    </p>
                </div>

                {/* Connection Legend */}
                {connectionLegend.length > 0 && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '20px 30px',
                        borderRadius: '12px',
                        boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
                    }}>
                        <h3 style={{
                            margin: '0 0 15px 0',
                            fontSize: '1.2rem',
                            fontWeight: '600',
                            color: '#1e3c72',
                            borderBottom: '2px solid #e0e0e0',
                            paddingBottom: '10px'
                        }}>
                            Connection Types
                        </h3>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '20px'
                        }}>
                            {connectionLegend.map((entry, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    <div style={{
                                        width: '30px',
                                        height: '4px',
                                        backgroundColor: entry.color,
                                        borderRadius: '2px'
                                    }} />
                                    <span style={{ color: '#333', fontWeight: '500' }}>{entry.type}</span>
                                    <span style={{ color: '#888', fontSize: '0.85rem' }}>({entry.count})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grid of Cards */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '25px',
                paddingBottom: '40px'
            }}>
                {graphData.nodes.map(node => {
                    const groupColor = GROUP_COLORS[node.group_type] || GROUP_COLORS.default;
                    const connections = graphData.links.filter(
                        link => link.source === node.id || link.target === node.id
                    );

                    return (
                        <div
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            style={{
                                background: 'white',
                                borderRadius: '15px',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                border: `3px solid ${groupColor}`,
                                transform: selectedNode?.id === node.id ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: selectedNode?.id === node.id ? '0 8px 30px rgba(0,0,0,0.3)' : '0 4px 15px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                if (selectedNode?.id !== node.id) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                                }
                            }}
                        >
                            {/* Image */}
                            {node.img && (
                                <div style={{
                                    width: '100%',
                                    height: '220px',
                                    background: `url(${node.img}) center/cover`,
                                    borderBottom: `4px solid ${groupColor}`
                                }} />
                            )}

                            {/* Content */}
                            <div style={{ padding: '20px' }}>
                                <h3 style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '1.3rem',
                                    fontWeight: '700',
                                    color: '#1e3c72'
                                }}>
                                    {node.name}
                                </h3>

                                <span style={{
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    color: 'white',
                                    background: groupColor,
                                    marginBottom: '12px'
                                }}>
                                    {node.group_type}
                                </span>

                                {node.description && (
                                    <p style={{
                                        margin: '0 0 15px 0',
                                        fontSize: '0.9rem',
                                        color: '#555',
                                        lineHeight: '1.5'
                                    }}>
                                        {node.description}
                                    </p>
                                )}

                                {/* Connection Count */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: '15px',
                                    paddingTop: '15px',
                                    borderTop: '1px solid #e0e0e0'
                                }}>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        color: '#888',
                                        fontWeight: '500'
                                    }}>
                                        Connections: {connections.length}
                                    </span>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        color: groupColor,
                                        fontWeight: '600'
                                    }}>
                                        Influence: {node.val || 1}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail Modal */}
            {selectedNode && (
                <div
                    onClick={() => setSelectedNode(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '20px',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            position: 'relative'
                        }}
                    >
                        <button
                            onClick={() => setSelectedNode(null)}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                            }}
                        >
                            ×
                        </button>

                        {selectedNode.img && (
                            <div style={{
                                width: '100%',
                                height: '300px',
                                background: `url(${selectedNode.img}) center/cover`,
                                borderRadius: '20px 20px 0 0'
                            }} />
                        )}

                        <div style={{ padding: '30px' }}>
                            <h2 style={{
                                margin: '0 0 10px 0',
                                fontSize: '2rem',
                                fontWeight: '700',
                                color: '#1e3c72'
                            }}>
                                {selectedNode.name}
                            </h2>

                            <span style={{
                                display: 'inline-block',
                                padding: '6px 16px',
                                borderRadius: '25px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                color: 'white',
                                background: GROUP_COLORS[selectedNode.group_type] || GROUP_COLORS.default,
                                marginBottom: '20px'
                            }}>
                                {selectedNode.group_type}
                            </span>

                            {selectedNode.description && (
                                <p style={{
                                    margin: 0,
                                    fontSize: '1.05rem',
                                    color: '#555',
                                    lineHeight: '1.7'
                                }}>
                                    {selectedNode.description}
                                </p>
                            )}

                            {/* Show connections */}
                            <div style={{ marginTop: '25px' }}>
                                <h4 style={{
                                    margin: '0 0 15px 0',
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: '#1e3c72',
                                    borderBottom: '2px solid #e0e0e0',
                                    paddingBottom: '8px'
                                }}>
                                    Key Connections
                                </h4>
                                {graphData.links
                                    .filter(link => link.source === selectedNode.id || link.target === selectedNode.id)
                                    .map((link, idx) => {
                                        const otherId = link.source === selectedNode.id ? link.target : link.source;
                                        const otherNode = graphData.nodes.find(n => n.id === otherId);
                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '10px',
                                                    marginBottom: '8px',
                                                    background: '#f5f5f5',
                                                    borderRadius: '8px',
                                                    borderLeft: `4px solid ${link.color || '#999'}`
                                                }}
                                            >
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: '600',
                                                    color: '#333'
                                                }}>
                                                    {otherNode?.name || 'Unknown'}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: '#666',
                                                    fontStyle: 'italic'
                                                }}>
                                                    {link.relation || 'Connection'}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfessionalView;
