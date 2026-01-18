import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RotateCcw, ArrowLeft } from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import GIF from 'gif.js';
import './App.css'; // Your CSS file

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

  const applyColorCorrection = useCallback((imageData) => {
    const data = imageData.data;
    const contrastFactor = contrast !== 0 ? (259 * (contrast + 255)) / (255 * (259 - contrast)) : null;
    const satFactor = saturation !== 0 ? (saturation + 100) / 100 : null;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r += temperature;
      b -= temperature;
      g += tint;
      r += brightness;
      g += brightness;
      b += brightness;

      if (contrastFactor !== null) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

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

  const detectOutputFormat = (file) => {
    const fileName = file.name.toLowerCase();
    if (file.type === 'image/webp' || fileName.endsWith('.webp')) return 'webp';
    if (file.type === 'image/png' || fileName.endsWith('.png')) return 'png';
    if (file.type === 'image/jpeg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'jpeg';
    if (file.type === 'image/bmp' || fileName.endsWith('.bmp')) return 'bmp';
    if (file.type === 'image/tiff' || fileName.endsWith('.tiff') || fileName.endsWith('.tif')) return 'png';
    if (file.type === 'image/x-icon' || fileName.endsWith('.ico')) return 'ico';
    if (file.type === 'image/svg+xml' || fileName.endsWith('.svg')) return 'png';
    return 'jpeg';
  };

  const loadStaticImage = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        originalImageRef.current = img;
        setImage(img);
        setIsAnimated(false);
        setFrames([]);
        setOutputFormat(detectOutputFormat(file));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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

  const updateFileSize = useCallback(() => {
    if (canvasRef.current) {
      const mimeType = outputFormat === 'webp' ? 'image/webp' : outputFormat === 'png' ? 'image/png' : 'image/jpeg';
      const qualityValue = outputFormat === 'png' ? undefined : quality / 100;
      canvasRef.current.toBlob((blob) => {
        if (blob) setFileSize((blob.size / 1024).toFixed(2));
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
          setOutputFormat(detectOutputFormat(file));
        };
        img.src = URL.createObjectURL(file);
      }
    }
  };

  const handleDragOver = (e) => e.preventDefault();

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
        if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
      };
    }
  }, [isAnimated, frames, applyColorCorrection]);

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
    if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
  };

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
    const canvas = canvasRef.current;
    if (outputFormat === 'ico') {
      downloadAsIco(canvas);
      return;
    }
    if (outputFormat === 'bmp') {
      downloadAsBmp(canvas);
      return;
    }
    const mimeType = outputFormat === 'webp' ? 'image/webp' : outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const extension = outputFormat;
    const qualityValue = outputFormat === 'png' ? undefined : quality / 100;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `corrected-image.${extension}`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, mimeType, qualityValue);
  };

  const downloadAsIco = async (canvas) => {
    // Create a properly sized canvas (ICO standard sizes: 16, 32, 48, 256)
    const size = 256; // Using 256x256 for best quality
    const icoCanvas = document.createElement('canvas');
    icoCanvas.width = size;
    icoCanvas.height = size;
    const ctx = icoCanvas.getContext('2d');
    
    // Draw image centered and scaled
    const scale = Math.min(size / canvas.width, size / canvas.height);
    const x = (size - canvas.width * scale) / 2;
    const y = (size - canvas.height * scale) / 2;
    ctx.drawImage(canvas, x, y, canvas.width * scale, canvas.height * scale);
    
    // Get PNG data
    const pngBlob = await new Promise(resolve => icoCanvas.toBlob(resolve, 'image/png'));
    const pngArrayBuffer = await pngBlob.arrayBuffer();
    const pngData = new Uint8Array(pngArrayBuffer);
    
    // Create ICO file structure
    const icoData = createICO(pngData, size);
    const blob = new Blob([icoData], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'corrected-image.ico';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createICO = (pngData, size) => {
    const pngSize = pngData.length;
    const icoSize = 6 + 16 + pngSize; // Header(6) + Directory(16) + PNG data
    const ico = new Uint8Array(icoSize);
    const view = new DataView(ico.buffer);
    
    // ICO Header (6 bytes)
    view.setUint16(0, 0, true);        // Reserved (0)
    view.setUint16(2, 1, true);        // Type (1 = ICO)
    view.setUint16(4, 1, true);        // Number of images (1)
    
    // Image Directory (16 bytes)
    ico[6] = size === 256 ? 0 : size;  // Width (0 means 256)
    ico[7] = size === 256 ? 0 : size;  // Height (0 means 256)
    ico[8] = 0;                         // Color palette (0 = no palette)
    ico[9] = 0;                         // Reserved
    view.setUint16(10, 1, true);       // Color planes
    view.setUint16(12, 32, true);      // Bits per pixel
    view.setUint32(14, pngSize, true); // Image size
    view.setUint32(18, 22, true);      // Image offset (6 + 16)
    
    // PNG data
    ico.set(pngData, 22);
    
    return ico;
  };

  const downloadAsBmp = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bmpData = createBMP(imageData);
    const blob = new Blob([bmpData], { type: 'image/bmp' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'corrected-image.bmp';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createBMP = (imageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const rowPadding = (4 - ((width * 3) % 4)) % 4;
    const rowSize = width * 3 + rowPadding;
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize;
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    view.setUint8(0, 0x42);
    view.setUint8(1, 0x4D);
    view.setUint32(2, fileSize, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, -height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(30, 0, true);
    view.setUint32(34, pixelDataSize, true);
    
    let offset = 54;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        view.setUint8(offset++, data[i + 2]);
        view.setUint8(offset++, data[i + 1]);
        view.setUint8(offset++, data[i]);
      }
      offset += rowPadding;
    }
    return buffer;
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
        <h1>Color Correction & Format Converter</h1>

        {!image ? (
          <div className="upload-container-wrapper">
            <label
              className="upload-label"
              onDrop={handleImageDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="upload-icon" />
              <span className="upload-title">Drag & Drop or</span>
              <span className="upload-action-text">Click to Upload Image</span>
              <span className="upload-hint-text">JPEG, PNG, WebP, GIF, BMP, TIFF, ICO, SVG & more</span>
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
                <div>
                  <label className="adjustment-label">
                    Temperature: <span className="adjustment-value">{temperature > 0 ? '+' : ''}{temperature}</span>
                  </label>
                  <input type="range" min="-100" max="100" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
                  <div className="range-range-labels">
                    <span>Cool (Blue)</span>
                    <span>Warm (Yellow)</span>
                  </div>
                </div>

                <div>
                  <label className="adjustment-label">
                    Tint: <span className="adjustment-value">{tint > 0 ? '+' : ''}{tint}</span>
                  </label>
                  <input type="range" min="-100" max="100" value={tint} onChange={(e) => setTint(Number(e.target.value))} />
                  <div className="range-range-labels">
                    <span>Magenta</span>
                    <span>Green</span>
                  </div>
                </div>

                <div>
                  <label className="adjustment-label">
                    Brightness: <span className="adjustment-value">{brightness > 0 ? '+' : ''}{brightness}</span>
                  </label>
                  <input type="range" min="-100" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                </div>

                <div>
                  <label className="adjustment-label">
                    Contrast: <span className="adjustment-value">{contrast > 0 ? '+' : ''}{contrast}</span>
                  </label>
                  <input type="range" min="-100" max="100" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                </div>

                <div>
                  <label className="adjustment-label">
                    Saturation: <span className="adjustment-value">{saturation > 0 ? '+' : ''}{saturation}</span>
                  </label>
                  <input type="range" min="-100" max="100" value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
                </div>

                <div className="compression-divider">
                  <label className="adjustment-label">
                    Compression Quality: <span className="adjustment-value">{quality}%</span>
                  </label>
                  <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                  <div className="range-range-labels">
                    <span>Smaller File (Low Quality)</span>
                    <span>Larger File (Best Quality)</span>
                  </div>

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

                {!isAnimated && (
                  <div className="compression-divider">
                    <label className="adjustment-label">Output Format</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                      {['jpeg', 'png', 'webp', 'bmp', 'ico'].map(format => (
                        <button
                          key={format}
                          onClick={() => setOutputFormat(format)}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: outputFormat === format ? '2px solid #3b82f6' : '1px solid #334155',
                            background: outputFormat === format ? '#3b82f6' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {outputFormat === 'ico' && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#1e293b', borderRadius: '8px', fontSize: '12px', color: '#94a3b8' }}>
                        💡 ICO files work best at 16x16, 32x32, or 256x256 pixels
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="action-buttons-group">
                <button onClick={handleBack} className="button reset-button">
                  <ArrowLeft className="icon" />
                  Back
                </button>
                <button onClick={handleReset} className="button reset-button">
                  <RotateCcw className="icon" />
                  Reset
                </button>
                <button onClick={handleDownload} className="button download-button">
                  <Download className="icon" />
                  Download {isAnimated ? 'Animated GIF' : `${outputFormat.toUpperCase()}`}
                </button>
              </div>
            </div>

            <div className="panel preview-panel">
              <h2 className="panel-title">Live Preview</h2>
              <div className="preview-wrapper">
                <canvas ref={canvasRef} className="preview-canvas" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}