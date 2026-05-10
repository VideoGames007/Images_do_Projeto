import { useState, useEffect } from 'react';
import * as allData from './data/index.js';
import './index.css';

function App() {
  const [history, setHistory] = useState([allData.rootIndex, allData._inspirador].filter(Boolean));
  const currentNode = history[history.length - 1];

  const visibleChildren = currentNode.children ? 
    currentNode.children.filter(child => !(currentNode.name === '_IMAGENS' && child.name === 'Games')) 
    : [];

  const navigateBack = () => {
    if (history.length > 1) {
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const getUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Remove leading slash and prepend BASE_URL
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return `${import.meta.env.BASE_URL}${cleanUrl}`;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace') {
        navigateBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  const navigateTo = (node) => {
    if (node.type === 'game_reference' || node.type === 'folder_reference') {
      const loadedNode = allData[node.file];
      if (loadedNode) {
        setHistory([...history, loadedNode]);
      } else {
        console.error('Falha ao carregar dados:', node.file);
      }
    } else {
      setHistory([...history, node]);
    }
  };

  const navigateToBreadcrumb = (index) => {
    setHistory(history.slice(0, index + 1));
  };

  return (
    <div className="app-container">
      <header>
        <h1>Galeria da Saga</h1>
        
        <div className="breadcrumbs">
          {history.map((node, idx) => (
            <span key={idx}>
              <span 
                className={`breadcrumb-item ${idx === history.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToBreadcrumb(idx)}
              >
                {node.name === '_IMAGENS' ? 'Início' : node.name}
              </span>
              {idx < history.length - 1 && <span className="breadcrumb-separator"> / </span>}
            </span>
          ))}
        </div>
      </header>

      <div className="fade-in">
        {history.length > 1 && (
          <button className="back-btn" onClick={navigateBack}>
            ← Voltar
          </button>
        )}

        {/* Texts Context */}
        {currentNode.texts && currentNode.texts.length > 0 && (
          <div className="context-section">
            {currentNode.texts.map((txt, idx) => (
              <div key={idx} className="glass-panel text-panel">
                <h4 className="text-title">{txt.title}</h4>
                <div className="synopsis-text">{txt.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* Subfolders Grid */}
        {visibleChildren && visibleChildren.length > 0 && (
          <div className="section">
            <h3 className="section-title">Pastas</h3>
            <div className="games-grid">
              {visibleChildren.map(child => (
                <div 
                  key={child.id} 
                  className="glass-panel game-card"
                  onClick={() => navigateTo(child)}
                >
                  <div className="card-image-wrapper">
                    {child.coverImage ? (
                      <img src={getUrl(child.coverImage)} alt={child.name} className="card-image" />
                    ) : (
                      <div className="placeholder-folder">
                        <span>📁</span>
                      </div>
                    )}
                  </div>
                  <div className="card-content folder-content">
                    <h3>{child.name}</h3>
                    <p>
                      {child.imagesCount !== undefined ? child.imagesCount : (child.images ? child.images.length : 0)} imagens | 
                      {child.childrenCount !== undefined ? child.childrenCount : (child.children ? child.children.length : 0)} pastas
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images Grid */}
        {currentNode.images && currentNode.images.length > 0 && (
          <div className="section">
            <h3 className="section-title">Imagens</h3>
            <div className="char-gallery">
              {currentNode.images.map((img, idx) => (
                <div key={idx} className="image-wrapper">
                  <a href={getUrl(img.url)} target="_blank" rel="noreferrer">
                    <img src={getUrl(img.url)} alt={img.name} className="gallery-img" />
                  </a>
                  <div className="image-name">{img.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!currentNode.children || currentNode.children.length === 0) && 
         (!currentNode.images || currentNode.images.length === 0) && 
         (!currentNode.texts || currentNode.texts.length === 0) && (
          <div className="glass-panel" style={{textAlign: 'center', padding: '3rem'}}>
            <p style={{color: 'var(--text-secondary)'}}>Esta pasta está vazia.</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
