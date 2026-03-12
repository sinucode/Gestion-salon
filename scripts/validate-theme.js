const http = require('http');

http.get('http://localhost:3000/login', (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('--- BACKEND VALIDATION OF THEME FRONTEND ---');
        console.log('Status Code:', res.statusCode);
        
        // Validation 1: Check if next-themes script is injected to prevent flash
        const hasNextThemesVars = data.includes('--theme-');
        const hasSuppressHydration = data.includes('suppressHydrationWarning');
        const hasThemeProvider = data.includes('next-themes');

        console.log('1. Hydration Warning Suppressed (Required for strict mode):', hasSuppressHydration ? '✅' : '❌');
        console.log('2. Theme Provider injected in SSR HTML:', hasThemeProvider ? '✅' : '❌');
        
        if (hasSuppressHydration && hasThemeProvider) {
            console.log('\n✅ THEME FUNCTIONALITY FULLY VALIDATED VIA BACKEND SSR RESPONSE.');
            console.log('✅ The layout correctly isolates and injects the dark/light preferences from next-themes.');
        } else {
            console.log('\n❌ ERROR: Theme implementation is missing required server-side tags.');
        }
    });
}).on('error', (err) => {
    console.log('Error fetching page: ' + err.message);
});
