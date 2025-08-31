// Font loading utilities
export async function ensureFontsLoaded() {
    return new Promise((resolve) => {
        const fontLinkId = 'worksheet-title-fonts';
        if (document.getElementById(fontLinkId) && document.fonts) {
            const fontFamilies = ['Permanent Marker', 'Pacifico', 'Bangers', 'Luckiest Guy', 'Caveat', 'Poppins'];
            const fontPromises = fontFamilies.map(font => document.fonts.load(`16px "${font}"`).catch(() => {}));
            Promise.allSettled(fontPromises).then(() => resolve());
            return;
        }
        if (!document.getElementById(fontLinkId)) {
            const link = document.createElement('link');
            link.id = fontLinkId;
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;600&family=Luckiest+Guy&family=Pacifico&family=Permanent+Marker&family=Poppins:wght@300;400;500;600;700&display=swap';
            link.addEventListener('load', () => {
                const testDiv = document.createElement('div');
                testDiv.style.position = 'absolute';
                testDiv.style.left = '-9999px';
                testDiv.style.visibility = 'hidden';
                testDiv.style.fontSize = '16px';
                testDiv.innerHTML = `
                    <span style="font-family: 'Permanent Marker', cursive;">Test</span>
                    <span style="font-family: 'Pacifico', cursive;">Test</span>
                    <span style="font-family: 'Bangers', fantasy;">Test</span>
                    <span style="font-family: 'Luckiest Guy', fantasy;">Test</span>
                    <span style="font-family: 'Caveat', cursive;">Test</span>
                    <span style="font-family: 'Poppins', sans-serif;">Test</span>
                `;
                document.body.appendChild(testDiv);
                if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(() => {
                        if (testDiv.parentNode) document.body.removeChild(testDiv);
                        resolve();
                    });
                } else {
                    setTimeout(() => {
                        if (testDiv.parentNode) document.body.removeChild(testDiv);
                        resolve();
                    }, 1000);
                }
            });
            link.addEventListener('error', () => resolve());
            document.head.appendChild(link);
        } else {
            setTimeout(() => resolve(), 100);
        }
    });
}
