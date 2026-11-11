/**
 * Generates an SVG feDisplacementMap Blob URL based on a squircle dome (liquid glass refraction).
 * @param {number} width - The width of the container
 * @param {number} height - The height of the container
 * @param {number} radius - Border radius for the squircle
 * @param {number} gain - The displacement scale
 * @returns {Promise<string>} Blob URL for the image
 */
export function createGlassDisplacementMap(width, height, radius = 16, gain = 60) {
    return new Promise((resolve) => {
        if (!width || !height) return resolve('');

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve('');
        
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // Signed distance function for rounded rectangle
        const sdRoundRect = (px, py, bx, by, r) => {
            const qx = Math.abs(px) - bx + r;
            const qy = Math.abs(py) - by + r;
            const len = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
            return Math.min(Math.max(qx, qy), 0.0) + len - r;
        };

        const bx = width / 2;
        const by = height / 2;

        // The rim width where the bend occurs. Fixed to 30px or constrained by dimensions
        const rimW = Math.min(30, Math.min(bx, by));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Map to center origin
                const px = x - bx;
                const py = y - by;

                const dist = sdRoundRect(px, py, bx, by, radius);
                
                let nx = 0;
                let ny = 0;
                let bend = 0;
                let specular = 0;

                // If inside the rounded rect
                if (dist <= 0) {
                    // Normal computation via gradient of SDF
                    const eps = 0.5;
                    const dx = sdRoundRect(px + eps, py, bx, by, radius) - dist;
                    const dy = sdRoundRect(px, py + eps, bx, by, radius) - dist;
                    const len = Math.sqrt(dx*dx + dy*dy) || 1;
                    nx = dx / len;
                    ny = dy / len;

                    // Compute bend based on optics
                    const dIn = Math.abs(dist); 
                    const depth = Math.min(dIn / rimW, 1.0); // 0 at edge, 1 at inner flat area

                    if (depth < 1.0) {
                        // Squircle dome surface equation
                        const slope = ((1 - depth) ** 3) / (((1 - (1 - depth) ** 4) ** 0.75) || 0.001);
                        const thetaI = Math.atan(slope);
                        const thetaT = Math.asin(Math.sin(thetaI) / 1.5); // 1.5 is glass refractive index
                        bend = Math.sin(thetaI - thetaT);
                        specular = Math.max(0, Math.min(255, slope * 100)); // Map some high slope to B channel for lighting
                    }
                }

                const i = (y * width + x) * 4;
                // R and G represent x and y displacement, 128 is center/neutral
                data[i] = Math.min(255, Math.max(0, 128 + nx * bend * gain));       // R
                data[i+1] = Math.min(255, Math.max(0, 128 + ny * bend * gain));     // G
                data[i+2] = specular;                                               // B
                data[i+3] = 255;                                                    // A
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(URL.createObjectURL(blob));
            } else {
                resolve('');
            }
        }, 'image/png');
    });
}
