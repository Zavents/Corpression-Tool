import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RotateCcw, StepBack, ArrowLeft } from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import GIF from 'gif.js';
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
  const [isAnimated, setIsAnimated] = useState(false);
  const [frames, setFrames] = useState([]);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const canvasRef = useRef(null);
  const originalImageRef = useRef(null);
  const animationFrameRef = useRef(null);
  const currentFrameRef = useRef(0);

  // Extract color correction logic into a reusable function
  const applyColorCorrection = useCallback((imageData) => {
    const data = imageData.data;
    
    // Pre-calculate factors outside the loop for better performance
    const contrastFactor = contrast !== 0 ? (259 * (contrast + 255)) / (255 * (259 - contrast)) : null;
    const satFactor = saturation !== 0 ? (saturation + 100) / 100 : null;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Temperature
      r += temperature;
      b -= temperature;
      
      // Tint
      g += tint;

      // Brightness
      r += brightness;
      g += brightness;
      b += brightness;

      // Contrast
      if (contrastFactor !== null) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

      // Saturation
      if (satFactor !== null) {
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        r = gray + (r - gray) * satFactor;
        g = gray + (g - gray) * satFactor;
        b = gray + (b - gray) * satFactor;
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
    
    return imageData;
  }, [temperature, tint, brightness, contrast, saturation]);

  // Extract GIF frames
  const extractGifFrames = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const gif = parseGIF(arrayBuffer);
    const frames = decompressFrames(gif, true);
    
    return frames.map(frame => {
      const canvas = document.createElement('canvas');
      canvas.width = frame.dims.width;
      canvas.height = frame.dims.height;
      const ctx = canvas.getContext('2d');
      
      const imageData = ctx.createImageData(frame.dims.width, frame.dims.height);
      imageData.data.set(frame.patch);
      ctx.putImageData(imageData, 0, 0);
      
      return {
        canvas: canvas,
        delay: frame.delay || 100,
        imageData: imageData,
        dims: frame.dims
      };
    });
  };

  // Load static image
  const loadStaticImage = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        originalImageRef.current = img;
        setImage(img);
        setIsAnimated(false);
        setFrames([]);
        
        if (file.type === 'image/webp') setOutputFormat('webp');
        else if (file.type === 'image/png') setOutputFormat('png');
        else setOutputFormat('jpeg');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Load animated GIF
  const loadAnimatedGif = async (file) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    setImage(img);
    
    const extractedFrames = await extractGifFrames(file);
    
    if (extractedFrames.length > 1) {
      setIsAnimated(true);
      setFrames(extractedFrames);
      setOutputFormat('gif');
    } else {
      setIsAnimated(false);
      setFrames([]);
      setOutputFormat('png');
    }
  };

  // Update file size calculation
  const updateFileSize = useCallback(() => {
    if (canvasRef.current) {
      const mimeType = outputFormat === 'webp' ? 'image/webp' : 
                       outputFormat === 'png' ? 'image/png' : 'image/jpeg';
      const qualityValue = outputFormat === 'png' ? undefined : quality / 100;
      
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          setFileSize((blob.size / 1024).toFixed(2));
        }
      }, mimeType, qualityValue);
    }
  }, [outputFormat, quality]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setOriginalSize((file.size / 1024).toFixed(2));
      
      if (file.type === 'image/gif') {
        await loadAnimatedGif(file);
      } else {
        loadStaticImage(file);
      }
    }
  };

  const handleImageDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setOriginalSize((file.size / 1024).toFixed(2));
      
      if (file.type === 'image/gif') {
        await loadAnimatedGif(file);
      } else {
        const img = new Image();
        img.onload = () => {
          originalImageRef.current = img;
          setImage(img);
          setIsAnimated(false);
          setFrames([]);
          
          if (file.type === 'image/webp') setOutputFormat('webp');
          else if (file.type === 'image/png') setOutputFormat('png');
          else setOutputFormat('jpeg');
        };
        img.src = URL.createObjectURL(file);
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault();
  };



  // Animated GIF preview with color corrections
  useEffect(() => {
    if (isAnimated && frames.length > 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = frames[0].canvas.width;
      canvas.height = frames[0].canvas.height;
      
      const animate = () => {
        const frame = frames[currentFrameRef.current];
        
        const imageData = ctx.createImageData(frame.imageData.width, frame.imageData.height);
        imageData.data.set(frame.imageData.data);
        
        const corrected = applyColorCorrection(imageData);
        ctx.putImageData(corrected, 0, 0);
        
        currentFrameRef.current = (currentFrameRef.current + 1) % frames.length;
        animationFrameRef.current = setTimeout(animate, frame.delay);
      };
      
      animate();
      
      return () => {
        if (animationFrameRef.current) {
          clearTimeout(animationFrameRef.current);
        }
      };
    }
  }, [isAnimated, frames, applyColorCorrection]);

  // Static image preview with color corrections
  useEffect(() => {
    if (image && !isAnimated && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = image.width;
      canvas.height = image.height;
      
      ctx.drawImage(image, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const corrected = applyColorCorrection(imageData);
      ctx.putImageData(corrected, 0, 0);
      
      updateFileSize();
    }
  }, [image, isAnimated, applyColorCorrection, updateFileSize]);

  const handleBack = () => {
    setImage(null);
    setFileSize(null);
    setOriginalSize(null);
    setIsAnimated(false);
    setFrames([]);
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
  }

  const handleReset = () => {
    setTemperature(0);
    setTint(0);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setQuality(90);
  };


  const handleDownload = async () => {
    if (!canvasRef.current) return;
    
    if (isAnimated && frames.length > 1) {
      await downloadAnimatedGif();
    } else {
      downloadStaticImage();
    }
  };

  const downloadStaticImage = () => {
    const mimeType = outputFormat === 'webp' ? 'image/webp' : 
                     outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const extension = outputFormat;
    const qualityValue = outputFormat === 'png' ? undefined : quality / 100;
    
    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `corrected-image.${extension}`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, mimeType, qualityValue);
  };

  const downloadAnimatedGif = async () => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: '/gif.worker.js'
    });
    
    frames.forEach(frame => {
      const canvas = document.createElement('canvas');
      canvas.width = frame.canvas.width;
      canvas.height = frame.canvas.height;
      const ctx = canvas.getContext('2d');
      
      const imageData = ctx.createImageData(frame.imageData.width, frame.imageData.height);
      imageData.data.set(frame.imageData.data);
      const corrected = applyColorCorrection(imageData);
      ctx.putImageData(corrected, 0, 0);
      
      gif.addFrame(canvas, { delay: frame.delay });
    });
    
    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'corrected-animation.gif';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
    
    gif.render();
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
            <label
              className="upload-label"
              onDrop={handleImageDrop}
              onDragOver={handleDragOver}
            >

              <Upload className="upload-icon" />

              <span className="upload-title">Drag & Drop or</span>

              <span className="upload-action-text">
                Click to Upload Image
              </span>

              <span className="upload-hint-text">JPEG, PNG, WebP, or GIF, Max 5MB</span>

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
              <h2 className="panel-title">
                Adjustments & Compression
                {isAnimated && <span style={{ fontSize: '12px', color: '#4ade80', marginLeft: '8px' }}>• ANIMATED</span>}
              </h2>

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

                {/* Output Format Selection (only for static images) */}
                {!isAnimated && (
                  <div className="compression-divider">
                    <label className="adjustment-label">Output Format</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {['jpeg', 'png', 'webp'].map(format => (
                        <button
                          key={format}
                          onClick={() => setOutputFormat(format)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: outputFormat === format ? '2px solid #3b82f6' : '1px solid #334155',
                            background: outputFormat === format ? '#3b82f6' : 'transparent',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="action-buttons-group">
                {/* Back */}
                <button
                  onClick={handleBack}
                  className="button reset-button"
                >
                  <ArrowLeft className="icon" />
                  Reset
                </button>

                {/* Reset */}
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
                  Download {isAnimated ? 'Animated GIF' : `${outputFormat.toUpperCase()}`}
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
    </div >
  );
}