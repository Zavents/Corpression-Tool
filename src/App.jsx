import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw } from 'lucide-react';
import './App.css'; // Importing the standard CSS

export default function App() {
  const [image, setImage] = useState(null);
  const [temperature, setTemperature] = useState(0);
  const [tint, setTint] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [quality, setQuality] = useState(90);
  const [fileSize, setFileSize] = useState(null);
  const [originalSize, setOriginalSize] = useState(null);
  const canvasRef = useRef(null);
  const originalImageRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setOriginalSize((file.size / 1024).toFixed(2));
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          originalImageRef.current = img;
          setImage(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = image.width;
      canvas.height = image.height;
      
      ctx.drawImage(image, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Temperature (Warmer: +R, -B)
        r += temperature;
        b -= temperature;
        // Tint (Green/Magenta: +G)
        g += tint;
        
        // Brightness
        r += brightness;
        g += brightness;
        b += brightness;
        
        // Contrast
        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
        
        // Saturation
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        const satFactor = (saturation + 100) / 100;
        r = gray + (r - gray) * satFactor;
        g = gray + (g - gray) * satFactor;
        b = gray + (b - gray) * satFactor;
        
        // Clamp values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setFileSize((blob.size / 1024).toFixed(2));
        }
      }, 'image/jpeg', quality / 100);
    }
  }, [image, temperature, tint, brightness, contrast, saturation, quality]);

  const handleReset = () => {
    setTemperature(0);
    setTint(0);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setQuality(90);
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `corrected-image-q${quality}.jpg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/jpeg', quality / 100);
    }
  };

  const getCompressionPercentage = () => {
    if (originalSize && fileSize) {
      return ((1 - fileSize / originalSize) * 100).toFixed(1);
    }
    return 0;
  };

  const compressionSavedClass = originalSize && fileSize && getCompressionPercentage() > 0 ? 'green' : 'yellow';

  return (
    <div className="app-main">
      <div className="app-container">
        <h1>Color Correction & Compression Tool</h1>
        
        {!image ? (
          <div className="upload-container-wrapper"> 
            <label className="upload-label">
              
              <Upload className="upload-icon" />
              
              <span className="upload-title">Drag & Drop or</span>
              
              <span className="upload-action-text">
                Click to Upload Image
              </span>
              
              <span className="upload-hint-text">JPEG or PNG, Max 5MB</span>
              
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="app-grid">
            <div className="panel adjustments-panel">
              <h2 className="panel-title">Adjustments & Compression</h2>
              
              <div className="adjustments-space">
                
                {/* Temperature */}
                <div>
                  <label className="adjustment-label">
                    Temperature: <span className="adjustment-value">{temperature > 0 ? '+' : ''}{temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                  />
                  <div className="range-range-labels">
                    <span>Cool (Blue)</span>
                    <span>Warm (Yellow)</span>
                  </div>
                </div>

                {/* Tint */}
                <div>
                  <label className="adjustment-label">
                    Tint: <span className="adjustment-value">{tint > 0 ? '+' : ''}{tint}</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={tint}
                    onChange={(e) => setTint(Number(e.target.value))}
                  />
                  <div className="range-range-labels">
                    <span>Magenta</span>
                    <span>Green</span>
                  </div>
                </div>

                {/* Brightness */}
                <div>
                  <label className="adjustment-label">
                    Brightness: <span className="adjustment-value">{brightness > 0 ? '+' : ''}{brightness}</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                  />
                </div>

                {/* Contrast */}
                <div>
                  <label className="adjustment-label">
                    Contrast: <span className="adjustment-value">{contrast > 0 ? '+' : ''}{contrast}</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                  />
                </div>

                {/* Saturation */}
                <div>
                  <label className="adjustment-label">
                    Saturation: <span className="adjustment-value">{saturation > 0 ? '+' : ''}{saturation}</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                  />
                </div>

                {/* Compression Quality */}
                <div className="compression-divider">
                  <label className="adjustment-label">
                    Compression Quality: <span className="adjustment-value">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                  <div className="range-range-labels">
                    <span>Smaller File (Low Quality)</span>
                    <span>Larger File (Best Quality)</span>
                  </div>
                  
                  {/* File Size Stats */}
                  {originalSize && fileSize && (
                    <div className="stats-box">
                      <div className="stat-row">
                        <span className="stat-label">Original Size:</span>
                        <span className="stat-value">{originalSize} KB</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Current Size:</span>
                        <span className="stat-value">{fileSize} KB</span>
                      </div>
                      <div className="stat-summary">
                        <span className="summary-label">Compression Saved:</span>
                        <span className={`summary-value ${compressionSavedClass}`}>
                          {getCompressionPercentage()}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons-group">
                <button
                  onClick={handleReset}
                  className="button reset-button"
                >
                  <RotateCcw className="icon" />
                  Reset
                </button>
                <button
                  onClick={handleDownload}
                  className="button download-button"
                >
                  <Download className="icon" />
                  Download Corrected JPEG
                </button>
              </div>
            </div>

            <div className="panel preview-panel">
              <h2 className="panel-title">Live Preview</h2>
              <div className="preview-wrapper">
                <canvas
                  ref={canvasRef}
                  className="preview-canvas"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}