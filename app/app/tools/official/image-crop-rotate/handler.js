/**
 * Image Crop & Rotate Tool Handler
 * 
 * This handler processes image files and provides an interactive preview with crop and rotate capabilities.
 * 
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  console.log("Image Crop & Rotate handler started");
  console.log("Changed widget:", changedWidgetIds);
  console.log("Input widgets:", JSON.stringify(Object.keys(inputWidgets)));

  const imageFiles = inputWidgets["input-image"];
  const previewState = inputWidgets["preview-label"];
  const convertBtnClicked = changedWidgetIds === "convert-btn";
  const imageChanged = changedWidgetIds === "input-image";

  // Initial load - no image uploaded yet
  if (!imageFiles || (Array.isArray(imageFiles) && imageFiles.length === 0)) {
    console.log("No image files uploaded yet");
    return {
      "preview-label" : buildInitialPreview(),
      "output-command": buildEmptyOutput("Command will appear here after conversion"),
      "output-preview": buildEmptyOutput("Converted images will appear here"),
    };
  }

  // Handle both single file and multiple files
  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles];
  console.log("Image files detected:", files.length, "files");

  // Use first file for preview and parameter extraction
  const firstFile = files[0];
  console.log("Using first file for preview:", firstFile.name, firstFile.type, firstFile.size);

  // Convert first file to DataURL for preview
  const imageDataUrl = await fileToDataUrl(firstFile);
  console.log("First image converted to DataURL, length:", imageDataUrl.length);

  // Get image dimensions
  const imageDimensions = await getImageDimensions(imageDataUrl);
  console.log("Image dimensions:", imageDimensions);

  // Check if user clicked convert button
  console.log("Convert button clicked:", convertBtnClicked);

  if (convertBtnClicked) {
    console.log("Starting image conversion with ImageMagick");

    // Read parameters from preview-label data
    const params = extractTransformParams(previewState, imageDimensions);
    console.log("Transform params:", params);

    // Execute ImageMagick conversion for all files
    const results = await convertImagesWithMagick(files, params, callback);
    console.log("All conversions completed, processed", results.length, "files");

    // Do NOT include preview-label key in return to prevent re-render
    // Only return output widgets that need updating
    return {
      "output-command": buildCommandOutput(params),
      "output-preview": buildResultsOutput(results),
    };
  }

  // Build interactive preview with controls
  // When user selects a new image, reset all parameters to defaults (ignore previous state)
  // Otherwise, preserve existing parameters from preview-label data
  const defaultParams = imageChanged
    ? getDefaultTransformParams(imageDimensions)
    : extractTransformParams(previewState, imageDimensions);
  console.log("Building preview with params:", defaultParams, "imageChanged:", imageChanged);

  return {
    "preview-label" : buildPreviewWithControls(imageDataUrl, imageDimensions, defaultParams),
    "output-command": buildEmptyOutput("Adjust the image and click 'Convert' to generate the command"),
    "output-preview": buildEmptyOutput("Results will appear after conversion"),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert File to DataURL
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions from DataURL
 */
function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Get default transform parameters for a new image
 * Used when user selects a new image to reset all parameters
 *
 * @param {object} imageDimensions - Image dimensions { width, height }
 * @returns {object} Default transform parameters
 */
function getDefaultTransformParams(imageDimensions) {
  const scale = 1.0;
  const rotation = 0;

  // Default crop to center 80%
  const defaultCropWidth = Math.floor(imageDimensions.width * 0.8);
  const defaultCropHeight = Math.floor(imageDimensions.height * 0.8);
  const defaultCropX = Math.floor((imageDimensions.width - defaultCropWidth) / 2);
  const defaultCropY = Math.floor((imageDimensions.height - defaultCropHeight) / 2);

  return {
    scale,
    rotation,
    cropX      : defaultCropX,
    cropY      : defaultCropY,
    cropWidth  : defaultCropWidth,
    cropHeight : defaultCropHeight,
    imageWidth : imageDimensions.width,
    imageHeight: imageDimensions.height,
  };
}

/**
 * Extract transform parameters from preview-label data or use defaults
 *
 * Per guide section 11.3, data-* attributes are collected with structure:
 * { "element-id": { "data-xxx": value } }
 *
 * Since we use id='preview-root' in the HTML, we read from data["preview-root"]
 */
function extractTransformParams(previewState, imageDimensions) {
  // Data structure per guide: { "element-id": { "data-xxx": value } }
  const rawData = previewState && previewState.data ? previewState.data : {};
  // Read from preview-root element's data-* attributes
  const data = rawData["preview-root"] || {};

  console.log("extractTransformParams - rawData:", JSON.stringify(rawData));
  console.log("extractTransformParams - data:", JSON.stringify(data));

  // If no data exists, use defaults
  if (!data || Object.keys(data).length === 0) {
    return getDefaultTransformParams(imageDimensions);
  }

  // Scale is fixed at 1.0 (no slider)
  const scale = 1.0;

  // Parse rotation (default 0) - data-rotation becomes "data-rotation" key
  const rotation = parseFloat(data["data-rotation"]) || 0;

  // Parse crop coordinates (default to center 80%)
  const defaultCropWidth = Math.floor(imageDimensions.width * 0.8);
  const defaultCropHeight = Math.floor(imageDimensions.height * 0.8);
  const defaultCropX = Math.floor((imageDimensions.width - defaultCropWidth) / 2);
  const defaultCropY = Math.floor((imageDimensions.height - defaultCropHeight) / 2);

  // data-crop-x becomes "data-crop-x" key
  const cropX = parseInt(data["data-crop-x"]) || defaultCropX;
  const cropY = parseInt(data["data-crop-y"]) || defaultCropY;
  const cropWidth = parseInt(data["data-crop-width"]) || defaultCropWidth;
  const cropHeight = parseInt(data["data-crop-height"]) || defaultCropHeight;

  return {
    scale,
    rotation,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    imageWidth : imageDimensions.width,
    imageHeight: imageDimensions.height,
  };
}

/**
 * Build initial preview message
 */
function buildInitialPreview() {
  return "<div class='text-sm text-muted-foreground leading-relaxed'>Upload images to start editing. You can adjust rotation and select a crop area. All uploaded images will be processed with the same settings.</div>";
}

/**
 * Build empty output message
 */
function buildEmptyOutput(message) {
  return `<div class='text-sm text-muted-foreground'>${message}</div>`;
}

/**
 * Build interactive preview with controls
 * Uses afterHook for event binding per Label dynamic interaction guide (section 11)
 */
function buildPreviewWithControls(imageDataUrl, imageDimensions, params) {
  const innerHtml = `
    <div id='preview-root' class='flex flex-col items-center gap-3' data-rotation='${params.rotation}' data-crop-x='${params.cropX}' data-crop-y='${params.cropY}' data-crop-width='${params.cropWidth}' data-crop-height='${params.cropHeight}'>
      <div class='relative border border-border rounded-md overflow-hidden bg-muted/20' style='width: 600px; height: 400px;'>
        <div id='image-container' class='absolute inset-0 flex items-center justify-center'>
          <img id='preview-image' src='${imageDataUrl}' class='max-w-full max-h-full object-contain' style='transform: rotate(${params.rotation}deg); transform-origin: center;' />
          <div id='crop-box' class='absolute border-2 border-primary bg-primary/10 cursor-move' style='left: 50px; top: 50px; width: 200px; height: 200px;'>
            <!-- Reference grid lines for crop alignment -->
            <div class='absolute inset-0 pointer-events-none'>
              <div class='absolute left-1/3 top-0 bottom-0 border-l-2 border-primary/80'></div>
              <div class='absolute left-2/3 top-0 bottom-0 border-l-2 border-primary/80'></div>
              <div class='absolute top-1/3 left-0 right-0 border-t-2 border-primary/80'></div>
              <div class='absolute top-2/3 left-0 right-0 border-t-2 border-primary/80'></div>
            </div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -left-1 -top-1 cursor-nw-resize' data-handle='nw'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full left-1/2 -translate-x-1/2 -top-1 cursor-n-resize' data-handle='n'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -right-1 -top-1 cursor-ne-resize' data-handle='ne'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -right-1 top-1/2 -translate-y-1/2 cursor-e-resize' data-handle='e'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -right-1 -bottom-1 cursor-se-resize' data-handle='se'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full left-1/2 -translate-x-1/2 -bottom-1 cursor-s-resize' data-handle='s'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -left-1 -bottom-1 cursor-sw-resize' data-handle='sw'></div>
            <div class='absolute w-2 h-2 bg-primary rounded-full -left-1 top-1/2 -translate-y-1/2 cursor-w-resize' data-handle='w'></div>
          </div>
        </div>
      </div>
      <div class='flex items-center gap-3' style='width: 600px;'>
        <div class='text-xs text-muted-foreground font-medium w-16'>Rotation</div>
        <input type='range' id='rotation-slider' min='-180' max='180' step='1' value='${params.rotation}' class='flex-1 cursor-pointer' />
        <div class='text-xs text-muted-foreground w-12 text-right' id='rotation-value'>${params.rotation}°</div>
      </div>
    </div>
  `;

  // Use afterHook instead of script for event binding (per guide section 11.2)
  // afterHook can access imageDimensions via closure, no need to serialize into script string
  const afterHook = buildPreviewAfterHook(imageDimensions);

  return { innerHtml, afterHook };
}

/**
 * Build afterHook function for interactive preview controls
 * Uses afterHook pattern per Label dynamic interaction guide (section 11.2)
 *
 * @param {object} imageDimensions - Image dimensions accessed via closure
 * @returns {function} afterHook function that receives container and binds events
 */
function buildPreviewAfterHook(imageDimensions) {
  // Access imageDimensions via closure - no need to serialize into script string
  const imgWidth = imageDimensions.width;
  const imgHeight = imageDimensions.height;
  const containerWidth = 600;
  const containerHeight = 400;

  // Return the afterHook function
  return function afterHook(container) {
    console.log("[AfterHook] Starting preview afterHook execution");

    // Query DOM elements using container.querySelector (per guide section 11.6)
    const previewRoot = container.querySelector("#preview-root");
    const rotationSlider = container.querySelector("#rotation-slider");
    const rotationValue = container.querySelector("#rotation-value");
    const previewImage = container.querySelector("#preview-image");
    const cropBox = container.querySelector("#crop-box");
    const imageContainer = container.querySelector("#image-container");

    console.log("[AfterHook] DOM elements found:", {
      hasPreviewRoot   : !!previewRoot,
      hasRotationSlider: !!rotationSlider,
      hasRotationValue : !!rotationValue,
      hasPreviewImage  : !!previewImage,
      hasCropBox       : !!cropBox,
      hasImageContainer: !!imageContainer,
    });

    if (!previewRoot || !rotationSlider || !cropBox || !imageContainer) {
      console.error("[AfterHook] Required DOM elements not found");
      return;
    }

    console.log("[AfterHook] Image dimensions:", { imgWidth, imgHeight, containerWidth, containerHeight });

    // Calculate display scale to fit image in container
    const displayScale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
    console.log("[AfterHook] Display scale calculated:", displayScale);

    // Image offset in container (centered)
    const imgOffsetX = (containerWidth - imgWidth * displayScale) / 2;
    const imgOffsetY = (containerHeight - imgHeight * displayScale) / 2;

    /**
     * Check if a point is inside the rotated image rectangle.
     * The rotated image is centered at (containerWidth/2, containerHeight/2).
     *
     * @param {number} px - Point x in display coordinates
     * @param {number} py - Point y in display coordinates
     * @param {number} angleDeg - Rotation angle in degrees
     * @returns {boolean} True if point is inside the rotated image
     */
    function isPointInRotatedImage(px, py, angleDeg) {
      const w = imgWidth * displayScale;
      const h = imgHeight * displayScale;
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      const angleRad = -angleDeg * Math.PI / 180; // Negative to reverse rotation

      // Translate point to origin (image center)
      const dx = px - cx;
      const dy = py - cy;

      // Rotate point back to image's local coordinate system
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      const localX = dx * cosA - dy * sinA;
      const localY = dx * sinA + dy * cosA;

      // Check if point is within unrotated image bounds (centered at origin)
      return Math.abs(localX) <= w / 2 && Math.abs(localY) <= h / 2;
    }

    /**
     * Check if all four corners of the crop box are inside the rotated image.
     *
     * @param {number} left - Crop box left position
     * @param {number} top - Crop box top position
     * @param {number} width - Crop box width
     * @param {number} height - Crop box height
     * @param {number} angleDeg - Rotation angle in degrees
     * @returns {boolean} True if entire crop box is inside the rotated image
     */
    function isCropBoxInRotatedImage(left, top, width, height, angleDeg) {
      const corners = [
        { x: left, y: top },
        { x: left + width, y: top },
        { x: left + width, y: top + height },
        { x: left, y: top + height },
      ];
      return corners.every(c => isPointInRotatedImage(c.x, c.y, angleDeg));
    }

    /**
     * Get the bounding box of the rotated image in display coordinates.
     * This is the outer boundary where crop box corners could potentially be.
     *
     * @param {number} angleDeg - Rotation angle in degrees
     * @returns {object} Bounding box { minX, minY, maxX, maxY }
     */
    function getRotatedImageBoundingBox(angleDeg) {
      const w = imgWidth * displayScale;
      const h = imgHeight * displayScale;
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      const angleRad = angleDeg * Math.PI / 180;
      const cosA = Math.abs(Math.cos(angleRad));
      const sinA = Math.abs(Math.sin(angleRad));

      // Bounding box dimensions after rotation
      const boundingW = w * cosA + h * sinA;
      const boundingH = h * cosA + w * sinA;

      return {
        minX: cx - boundingW / 2,
        minY: cy - boundingH / 2,
        maxX: cx + boundingW / 2,
        maxY: cy + boundingH / 2,
      };
    }

    /**
     * Constrain a proposed crop box position using binary search.
     * Finds the furthest valid position toward the proposed position.
     *
     * @param {number} currentLeft - Current left position
     * @param {number} currentTop - Current top position
     * @param {number} proposedLeft - Proposed left position
     * @param {number} proposedTop - Proposed top position
     * @param {number} width - Crop box width
     * @param {number} height - Crop box height
     * @param {number} angleDeg - Rotation angle
     * @returns {object} Constrained position { left, top }
     */
    function constrainPosition(currentLeft, currentTop, proposedLeft, proposedTop, width, height, angleDeg) {
      // If proposed position is valid, use it directly
      if (isCropBoxInRotatedImage(proposedLeft, proposedTop, width, height, angleDeg)) {
        return { left: proposedLeft, top: proposedTop };
      }

      // Binary search to find the furthest valid position
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) { // 10 iterations for precision
        const mid = (lo + hi) / 2;
        const testLeft = currentLeft + (proposedLeft - currentLeft) * mid;
        const testTop = currentTop + (proposedTop - currentTop) * mid;
        if (isCropBoxInRotatedImage(testLeft, testTop, width, height, angleDeg)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return {
        left: currentLeft + (proposedLeft - currentLeft) * lo,
        top : currentTop + (proposedTop - currentTop) * lo,
      };
    }

    /**
     * Get current rotation angle from data attribute
     * @returns {number} Rotation angle in degrees
     */
    function getCurrentRotation() {
      return parseFloat(previewRoot.dataset.rotation) || 0;
    }

    /**
     * Calculate the largest axis-aligned inscribed rectangle inside the rotated image.
     * Used to constrain crop box size when it exceeds the valid area after rotation.
     *
     * @param {number} angleDeg - Rotation angle in degrees
     * @returns {object} Maximum size { width, height }
     */
    function getMaxInscribedSize(angleDeg) {
      const w = imgWidth * displayScale;
      const h = imgHeight * displayScale;

      // Normalize angle to [0, 90] for calculation
      let normAngle = Math.abs(angleDeg) % 180;
      if (normAngle > 90) normAngle = 180 - normAngle;

      if (normAngle < 0.01) return { width: w, height: h };
      if (Math.abs(normAngle - 90) < 0.01) return { width: h, height: w };

      const angleRad = normAngle * Math.PI / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      // Bounding box of rotated image
      const boundingW = w * cosA + h * sinA;
      const boundingH = h * cosA + w * sinA;

      // Scale factor to fit inscribed rectangle inside rotated image
      const scaleFactor = Math.min(w / boundingW, h / boundingH);

      return {
        width : Math.max(40, w * scaleFactor),
        height: Math.max(40, h * scaleFactor),
      };
    }

    /**
     * Constrain crop box position and size within rotated image bounds.
     * When rotation changes and crop box exceeds valid area, shrink it to fit.
     */
    function constrainCropBox() {
      const rotation = getCurrentRotation();
      const minBoxSize = 20;

      let left = cropBox.offsetLeft;
      let top = cropBox.offsetTop;
      let width = cropBox.offsetWidth;
      let height = cropBox.offsetHeight;

      // Ensure minimum size
      width = Math.max(minBoxSize, width);
      height = Math.max(minBoxSize, height);

      // Get bounding box as outer limit
      const bbox = getRotatedImageBoundingBox(rotation);

      // Clamp to bounding box first (quick reject)
      left = Math.max(bbox.minX, Math.min(bbox.maxX - width, left));
      top = Math.max(bbox.minY, Math.min(bbox.maxY - height, top));

      // Try to find a valid position by moving toward center
      const cx = containerWidth / 2 - width / 2;
      const cy = containerHeight / 2 - height / 2;

      // Check if centered position is valid (if not, box is too large)
      if (!isCropBoxInRotatedImage(cx, cy, width, height, rotation)) {
        // Box is too large for current rotation - shrink to max inscribed size
        const maxSize = getMaxInscribedSize(rotation);
        width = Math.min(width, maxSize.width);
        height = Math.min(height, maxSize.height);
        // Re-center with new size
        left = containerWidth / 2 - width / 2;
        top = containerHeight / 2 - height / 2;
      } else if (!isCropBoxInRotatedImage(left, top, width, height, rotation)) {
        // Current position invalid but size is OK - find valid position
        const result = constrainPosition(cx, cy, left, top, width, height, rotation);
        left = result.left;
        top = result.top;
      }

      cropBox.style.left = left + "px";
      cropBox.style.top = top + "px";
      cropBox.style.width = width + "px";
      cropBox.style.height = height + "px";
    }

    // Initialize crop box position based on data attributes
    function initCropBox() {
      const rotation = getCurrentRotation();
      const cropX = parseFloat(previewRoot.dataset.cropX) || Math.floor(imgWidth * 0.1);
      const cropY = parseFloat(previewRoot.dataset.cropY) || Math.floor(imgHeight * 0.1);
      const cropW = parseFloat(previewRoot.dataset.cropWidth) || Math.floor(imgWidth * 0.8);
      const cropH = parseFloat(previewRoot.dataset.cropHeight) || Math.floor(imgHeight * 0.8);

      console.log("[AfterHook] Initializing crop box with data:", { cropX, cropY, cropW, cropH });

      // Convert image coordinates to display coordinates
      let displayX = cropX * displayScale + imgOffsetX;
      let displayY = cropY * displayScale + imgOffsetY;
      let displayW = cropW * displayScale;
      let displayH = cropH * displayScale;

      // Ensure minimum size
      const minBoxSize = 20;
      displayW = Math.max(minBoxSize, displayW);
      displayH = Math.max(minBoxSize, displayH);

      // Constrain position within rotated image bounds
      const bbox = getRotatedImageBoundingBox(rotation);
      displayX = Math.max(bbox.minX, Math.min(bbox.maxX - displayW, displayX));
      displayY = Math.max(bbox.minY, Math.min(bbox.maxY - displayH, displayY));

      // If not valid, move toward center
      if (!isCropBoxInRotatedImage(displayX, displayY, displayW, displayH, rotation)) {
        const cx = containerWidth / 2 - displayW / 2;
        const cy = containerHeight / 2 - displayH / 2;
        const result = constrainPosition(cx, cy, displayX, displayY, displayW, displayH, rotation);
        displayX = result.left;
        displayY = result.top;
      }

      console.log("[AfterHook] Display coordinates:", { displayX, displayY, displayW, displayH });

      cropBox.style.left = displayX + "px";
      cropBox.style.top = displayY + "px";
      cropBox.style.width = displayW + "px";
      cropBox.style.height = displayH + "px";
    }

    initCropBox();

    // State variables for drag and resize operations
    let isDragging = false;
    let isResizing = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeHandle = null;
    let boxStartLeft = 0;
    let boxStartTop = 0;
    let boxStartWidth = 0;
    let boxStartHeight = 0;

    // Update rotation - writes state to data-* attribute (per guide section 11.3)
    function updateRotation() {
      const rotation = parseFloat(rotationSlider.value);
      console.log("[AfterHook] Updating rotation:", rotation);
      previewRoot.dataset.rotation = rotation;
      rotationValue.textContent = rotation + "°";
      previewImage.style.transform = `rotate(${rotation}deg)`;

      // Re-constrain crop box when rotation changes
      constrainCropBox();
      updateCropData();
    }

    // Update crop box data - writes state to data-* attributes (per guide section 11.3)
    function updateCropData() {
      const rect = cropBox.getBoundingClientRect();
      const containerRect = imageContainer.getBoundingClientRect();

      // Get display coordinates relative to container
      const displayX = rect.left - containerRect.left;
      const displayY = rect.top - containerRect.top;
      const displayW = rect.width;
      const displayH = rect.height;

      // Convert to image coordinates
      const cropX = Math.max(0, Math.min(imgWidth, Math.round((displayX - imgOffsetX) / displayScale)));
      const cropY = Math.max(0, Math.min(imgHeight, Math.round((displayY - imgOffsetY) / displayScale)));
      const cropW = Math.max(1, Math.min(imgWidth - cropX, Math.round(displayW / displayScale)));
      const cropH = Math.max(1, Math.min(imgHeight - cropY, Math.round(displayH / displayScale)));

      console.log("[AfterHook] Updating crop data:", { cropX, cropY, cropW, cropH });

      previewRoot.dataset.cropX = cropX;
      previewRoot.dataset.cropY = cropY;
      previewRoot.dataset.cropWidth = cropW;
      previewRoot.dataset.cropHeight = cropH;
    }

    // Drag crop box handlers
    function handleCropBoxMouseDown(e) {
      if (e.target !== cropBox) return;
      console.log("[AfterHook] Starting drag operation");
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      boxStartLeft = cropBox.offsetLeft;
      boxStartTop = cropBox.offsetTop;
      e.preventDefault();
    }

    function handleDocumentMouseMove(e) {
      const rotation = getCurrentRotation();

      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const boxWidth = cropBox.offsetWidth;
        const boxHeight = cropBox.offsetHeight;

        // Calculate proposed new position
        const proposedLeft = boxStartLeft + dx;
        const proposedTop = boxStartTop + dy;

        // Use constrainPosition to find valid position within rotated image
        const result = constrainPosition(
          boxStartLeft, boxStartTop,
          proposedLeft, proposedTop,
          boxWidth, boxHeight, rotation
        );

        cropBox.style.left = result.left + "px";
        cropBox.style.top = result.top + "px";
      } else if (isResizing) {
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        const minBoxSize = 20;

        let newLeft = boxStartLeft;
        let newTop = boxStartTop;
        let newWidth = boxStartWidth;
        let newHeight = boxStartHeight;

        // Calculate proposed dimensions based on resize handle
        if (resizeHandle.includes("e")) {
          newWidth = Math.max(minBoxSize, boxStartWidth + dx);
        }
        if (resizeHandle.includes("w")) {
          const proposedWidth = Math.max(minBoxSize, boxStartWidth - dx);
          newLeft = boxStartLeft + boxStartWidth - proposedWidth;
          newWidth = proposedWidth;
        }
        if (resizeHandle.includes("s")) {
          newHeight = Math.max(minBoxSize, boxStartHeight + dy);
        }
        if (resizeHandle.includes("n")) {
          const proposedHeight = Math.max(minBoxSize, boxStartHeight - dy);
          newTop = boxStartTop + boxStartHeight - proposedHeight;
          newHeight = proposedHeight;
        }

        // Check if the new box is valid within rotated image
        if (isCropBoxInRotatedImage(newLeft, newTop, newWidth, newHeight, rotation)) {
          cropBox.style.left = newLeft + "px";
          cropBox.style.top = newTop + "px";
          cropBox.style.width = newWidth + "px";
          cropBox.style.height = newHeight + "px";
        } else {
          // Use binary search to find maximum valid resize
          let lo = 0, hi = 1;
          for (let i = 0; i < 10; i++) {
            const mid = (lo + hi) / 2;
            const testLeft = boxStartLeft + (newLeft - boxStartLeft) * mid;
            const testTop = boxStartTop + (newTop - boxStartTop) * mid;
            const testWidth = boxStartWidth + (newWidth - boxStartWidth) * mid;
            const testHeight = boxStartHeight + (newHeight - boxStartHeight) * mid;
            if (isCropBoxInRotatedImage(testLeft, testTop, testWidth, testHeight, rotation)) {
              lo = mid;
            } else {
              hi = mid;
            }
          }
          const finalLeft = boxStartLeft + (newLeft - boxStartLeft) * lo;
          const finalTop = boxStartTop + (newTop - boxStartTop) * lo;
          const finalWidth = boxStartWidth + (newWidth - boxStartWidth) * lo;
          const finalHeight = boxStartHeight + (newHeight - boxStartHeight) * lo;
          cropBox.style.left = finalLeft + "px";
          cropBox.style.top = finalTop + "px";
          cropBox.style.width = finalWidth + "px";
          cropBox.style.height = finalHeight + "px";
        }
      }
    }

    function handleDocumentMouseUp() {
      if (isDragging) {
        console.log("[AfterHook] Ending drag operation");
        isDragging = false;
        updateCropData();
      }
      if (isResizing) {
        console.log("[AfterHook] Ending resize operation");
        isResizing = false;
        resizeHandle = null;
        updateCropData();
      }
    }

    // Resize crop box handlers
    function handleResizeHandleMouseDown(e) {
      console.log("[AfterHook] Starting resize operation, handle:", e.target.dataset.handle);
      isResizing = true;
      resizeHandle = e.target.dataset.handle;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      boxStartLeft = cropBox.offsetLeft;
      boxStartTop = cropBox.offsetTop;
      boxStartWidth = cropBox.offsetWidth;
      boxStartHeight = cropBox.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    }

    // Add event listeners
    console.log("[AfterHook] Adding event listeners");
    cropBox.addEventListener("mousedown", handleCropBoxMouseDown);
    rotationSlider.addEventListener("input", updateRotation);

    // Add resize handle listeners
    const resizeHandles = container.querySelectorAll("[data-handle]");
    resizeHandles.forEach((handle) => {
      handle.addEventListener("mousedown", handleResizeHandleMouseDown);
    });
    console.log("[AfterHook] Added listeners to", resizeHandles.length, "resize handles");

    // Add document-level listeners
    document.addEventListener("mousemove", handleDocumentMouseMove);
    document.addEventListener("mouseup", handleDocumentMouseUp);

    // Return cleanup function (per guide section 11.2)
    // This will be called when component updates or unmounts
    return function cleanup() {
      console.log("[AfterHook] Running cleanup function");
      cropBox.removeEventListener("mousedown", handleCropBoxMouseDown);
      rotationSlider.removeEventListener("input", updateRotation);

      resizeHandles.forEach((handle) => {
        handle.removeEventListener("mousedown", handleResizeHandleMouseDown);
      });

      document.removeEventListener("mousemove", handleDocumentMouseMove);
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      console.log("[AfterHook] Cleanup completed");
    };
  };
}

/**
 * Convert multiple images using ImageMagick with same parameters
 */
async function convertImagesWithMagick(imageFiles, params, callback) {
  console.log("Loading ImageMagick WASM...");

  callback({
    "output-command": buildEmptyOutput("Loading ImageMagick..."),
    "output-preview": buildEmptyOutput("Processing images..."),
  });

  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();

  console.log("ImageMagick loaded, processing", imageFiles.length, "files");

  const results = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    console.log(`Processing file ${i + 1}/${imageFiles.length}: ${imageFile.name}`);

    callback({
      "output-command": buildEmptyOutput("Loading ImageMagick..."),
      "output-preview": buildEmptyOutput(`Processing ${i + 1}/${imageFiles.length}: ${imageFile.name}`),
    });

    try {
      // Read file as Uint8Array
      const imageBytes = new Uint8Array(await imageFile.arrayBuffer());

      let resultBytes = null;

      // Process image with ImageMagick
      Magick.ImageMagick.read(imageBytes, (image) => {
        console.log(`Image loaded: ${image.width} x ${image.height}, format: ${image.format}`);

        // Apply rotation first
        if (params.rotation !== 0) {
          console.log("Applying rotation:", params.rotation);
          image.rotate(params.rotation);
        }

        // Apply crop using MagickGeometry
        console.log("Applying crop:", params.cropX, params.cropY, params.cropWidth, params.cropHeight);
        const geometry = new Magick.MagickGeometry(params.cropWidth, params.cropHeight);
        geometry.x = params.cropX;
        geometry.y = params.cropY;
        console.log("Geometry created:", geometry.width, geometry.height, geometry.x, geometry.y);
        image.crop(geometry);

        // Ensure output format is PNG
        image.format = Magick.MagickFormat.Png;
        console.log("Output format set to:", image.format);

        // Write result as PNG
        image.write((data) => {
          resultBytes = data;
          console.log("ImageMagick write completed, bytes length:", data.length);
        });
      });

      if (!resultBytes) {
        throw new Error(`Failed to convert image: ${imageFile.name}`);
      }

      console.log(`Conversion completed for ${imageFile.name}, result size:`, resultBytes.length);

      // Convert to DataURL
      const blob = new Blob([resultBytes], { type: "image/png" });
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      results.push({
        dataUrl,
        bytes           : resultBytes,
        filename        : imageFile.name.replace(/\.[^.]+$/, "") + "_converted.png",
        originalFilename: imageFile.name,
      });

    } catch (error) {
      console.error(`Error processing ${imageFile.name}:`, error);
      // Continue with other files even if one fails
    }
  }

  console.log(`All conversions completed, successfully processed ${results.length}/${imageFiles.length} files`);
  return results;
}

/**
 * Build command output display
 * Uses afterHook for copy button event binding (per guide section 11.2)
 */
function buildCommandOutput(params) {
  const command = `convert input.png -rotate ${params.rotation} +repage -crop ${params.cropWidth}x${params.cropHeight}+${params.cropX}+${params.cropY} +repage output.png`;

  const innerHtml = `
    <div class='space-y-2'>
      <div class='text-sm font-semibold text-foreground'>ImageMagick Command</div>
      <div class='relative'>
        <code class='block rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground overflow-x-auto'>${command}</code>
        <button id='copy-btn' class='absolute top-2 right-2 inline-flex items-center rounded-sm bg-background/80 px-2 py-1 text-xs font-medium hover:bg-background'>
          Copy
        </button>
      </div>
    </div>
  `;

  // Use afterHook with closure to access command (per guide section 11.7)
  const afterHook = (container) => {
    const copyBtn = container.querySelector("#copy-btn");
    if (!copyBtn) return;

    const handleClick = async () => {
      // Access command via closure
      await navigator.clipboard.writeText(command);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    };

    copyBtn.addEventListener("click", handleClick);

    // Return cleanup function
    return () => {
      copyBtn.removeEventListener("click", handleClick);
    };
  };

  return { innerHtml, afterHook };
}

/**
 * Build results output display for multiple images
 * Uses afterHook for copy button event binding
 */
function buildResultsOutput(results) {
  if (!results || results.length === 0) {
    return buildEmptyOutput("No images were successfully converted");
  }

  const imagesHtml = results.map((result, index) => `
    <div class='border border-border rounded-md overflow-hidden bg-muted/20'>
      <div class='px-3 py-2 border-b border-border bg-muted/50'>
        <div class='text-sm font-medium text-foreground'>${result.originalFilename}</div>
      </div>
      <img src='${result.dataUrl}' class='max-w-full h-auto' />
      <div class='px-3 py-2 border-t border-border flex items-center gap-3'>
        <a href='${result.dataUrl}' download='${result.filename}' class='text-sm text-primary hover:underline'>
          Download
        </a>
        <span class='text-muted-foreground'>|</span>
        <button class='copy-image-btn text-sm text-primary hover:underline cursor-pointer bg-transparent border-0 p-0' data-index='${index}'>
          Copy
        </button>
      </div>
    </div>
  `).join("");

  // Create batch download HTML page
  const batchDownloadHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Image Download Links</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .download-link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; border-radius: 4px; }
        .download-link:hover { background: #e0e0e0; }
      </style>
    </head>
    <body>
      <h2>Download All Converted Images</h2>
      <p>Click each link below to download the images:</p>
      ${results.map(result => `<a href="${result.dataUrl}" download="${result.filename}" class="download-link">Download ${result.filename}</a>`).join("")}
    </body>
    </html>
  `;

  const batchDownloadDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(batchDownloadHtml)}`;

  const innerHtml = `
    <div class='space-y-4'>
      <div class='flex items-center justify-between'>
        <div class='text-sm font-semibold text-foreground'>Converted Images (${results.length})</div>
        <a href='${batchDownloadDataUrl}' download='download_links.html' class='text-sm text-primary hover:underline'>
          Download All
        </a>
      </div>
      <div class='grid gap-4' style='grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));'>
        ${imagesHtml}
      </div>
    </div>
  `;

  // Use afterHook with closure to access results array
  const afterHook = (container) => {
    const copyButtons = container.querySelectorAll(".copy-image-btn");
    if (!copyButtons || copyButtons.length === 0) return;

    console.log("[ResultsOutput] Found", copyButtons.length, "copy buttons");

    const handleCopyClick = async (event) => {
      const button = event.currentTarget;
      const index = parseInt(button.dataset.index);
      const result = results[index];

      if (!result || !result.dataUrl) {
        console.error("[ResultsOutput] No image data found for index", index);
        return;
      }

      try {
        console.log("[ResultsOutput] Starting copy process for:", result.filename);
        console.log("[ResultsOutput] DataURL prefix:", result.dataUrl.substring(0, 50));

        // Convert DataURL to Blob
        // DataURL format: data:image/png;base64,<base64-data>
        const response = await fetch(result.dataUrl);
        const blob = await response.blob();

        console.log("[ResultsOutput] Blob created:", {
          type: blob.type,
          size: blob.size,
        });

        // Verify blob is valid by creating an Image
        const testImg = new Image();
        const blobUrl = URL.createObjectURL(blob);

        await new Promise((resolve, reject) => {
          testImg.onload = () => {
            console.log("[ResultsOutput] Blob validation successful, image dimensions:", testImg.width, "x", testImg.height);
            URL.revokeObjectURL(blobUrl);
            resolve();
          };
          testImg.onerror = (err) => {
            console.error("[ResultsOutput] Blob validation failed:", err);
            URL.revokeObjectURL(blobUrl);
            reject(new Error("Invalid image blob"));
          };
          testImg.src = blobUrl;
        });

        console.log("[ResultsOutput] Attempting to write to clipboard...");

        // Copy to clipboard using Clipboard API
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);

        console.log("[ResultsOutput] Image copied to clipboard successfully:", result.filename);

        // Update button text to show success
        const originalText = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      } catch (error) {
        console.error("[ResultsOutput] Failed to copy image:", error);
        console.error("[ResultsOutput] Error stack:", error.stack);
        button.textContent = "Failed";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 2000);
      }
    };

    // Add click listeners to all copy buttons
    copyButtons.forEach((button) => {
      button.addEventListener("click", handleCopyClick);
    });

    // Return cleanup function
    return () => {
      console.log("[ResultsOutput] Cleaning up copy button listeners");
      copyButtons.forEach((button) => {
        button.removeEventListener("click", handleCopyClick);
      });
    };
  };

  return { innerHtml, afterHook };
}
