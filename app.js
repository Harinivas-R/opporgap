// Elements
const analyzeBtn = document.getElementById('analyzeBtn');
const gpsBtn = document.getElementById('gpsBtn');
const locationInput = document.getElementById('locationInput');
const dashboard = document.getElementById('dashboard');
const searchError = document.getElementById('searchError');
const analysisLocationLabel = document.getElementById('analysisLocationLabel');

// Stats Elements
const statTotalBiz = document.getElementById('statTotalBiz');
const statSaturation = document.getElementById('statSaturation');
const statTopOpp = document.getElementById('statTopOpp');

// Logic variables
let mapInstance = null;
let categoryChartInstance = null;
let demandChartInstance = null;

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 20) {
            nav.classList.add('shadow-md', 'backdrop-blur-xl', 'bg-white/95');
            nav.classList.remove('bg-white/80', 'shadow-sm');
        } else {
            nav.classList.remove('shadow-md', 'backdrop-blur-xl', 'bg-white/95');
            nav.classList.add('bg-white/80', 'shadow-sm');
        }
    });

    // Mock category filters logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-slate-900', 'text-white');
                b.classList.add('bg-white', 'text-slate-600');
            });
            e.target.classList.remove('bg-white', 'text-slate-600');
            e.target.classList.add('bg-slate-900', 'text-white');
            // Mock refreshing data
            animateValues();
        });
    });

    // Clear stored coords if user types manually
    locationInput.addEventListener('input', () => {
        delete locationInput.dataset.lat;
        delete locationInput.dataset.lng;
    });
});

// GPS Button logic
gpsBtn.addEventListener('click', () => {
    gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                try {
                    // Reverse geocoding using Nominatim (OpenStreetMap)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`);
                    const data = await response.json();
                    
                    let locationName = '';
                    if (data.address) {
                        const city = data.address.city || data.address.town || data.address.village || data.address.county;
                        const state = data.address.state;
                        locationName = `${city ? city + ', ' : ''}${state ? state : data.display_name.split(',')[0]}`;
                    } else if (data.display_name) {
                        locationName = data.display_name.split(',')[0] + ', ' + data.display_name.split(',')[1];
                    } else {
                        locationName = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    }
                    
                    locationInput.value = locationName;
                    
                    // We can store actual coordinates to use in map
                    locationInput.dataset.lat = lat;
                    locationInput.dataset.lng = lng;

                } catch (error) {
                    locationInput.value = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    locationInput.dataset.lat = lat;
                    locationInput.dataset.lng = lng;
                }

                gpsBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> Found';
                searchError.classList.add('hidden', 'opacity-0');
                setTimeout(() => {
                    gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Locate Me';
                }, 2000);
            },
            (err) => {
                // Fallback to sample
                locationInput.value = 'New York, NY (Mocked)';
                gpsBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> Local';
                searchError.classList.add('hidden', 'opacity-0');
                setTimeout(() => {
                    gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Locate Me';
                }, 2000);
            }
        );
    } else {
        locationInput.value = 'San Francisco, CA (Mocked)';
        gpsBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> Local';
        searchError.classList.add('hidden', 'opacity-0');
        setTimeout(() => {
            gpsBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Locate Me';
        }, 2000);
    }
});

// Analyze Button logic
analyzeBtn.addEventListener('click', async () => {
    const loc = locationInput.value.trim();
    if (!loc) {
        searchError.classList.remove('hidden');
        searchError.classList.remove('opacity-0');
        searchError.classList.add('animate-pulse');
        locationInput.parentElement.classList.add('border-rose-400', 'bg-rose-50');
        setTimeout(() => {
            locationInput.parentElement.classList.remove('border-rose-400', 'bg-rose-50');
            searchError.classList.remove('animate-pulse');
        }, 800);
        return;
    }

    searchError.classList.add('hidden', 'opacity-0');
    analysisLocationLabel.innerText = loc;
    
    // Button loading state
    const originalBtnContent = analyzeBtn.innerHTML;
    analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    analyzeBtn.classList.add('opacity-80', 'pointer-events-none');

    // Attempt forward geocoding if lat/lng are not stored
    let lat = null;
    let lng = null;
    let foundLocationName = loc;
    
    if (locationInput.dataset.lat && locationInput.dataset.lng) {
        lat = parseFloat(locationInput.dataset.lat);
        lng = parseFloat(locationInput.dataset.lng);
    } else if (!loc.includes("Mocked")) {
        try {
            // Nominatim API requires a User-Agent header, otherwise it may block the request
            // Adding a broad search that works better for pin codes and areas
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}&limit=1`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'OpporGap-App/1.0'
                }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
                
                // If the user typed a vague "600001", try to read the full display name to clarify it to them
                if (data[0].display_name) {
                    foundLocationName = data[0].display_name.split(',')[0] + ', ' + data[0].display_name.split(',').pop().trim();
                    analysisLocationLabel.innerText = foundLocationName;
                }
            }
        } catch(e) { console.error("Geocoding failed:", e); /* silent fail handled below */ }
    } else {
        // Mock fallback
        lat = 40.7128;
        lng = -74.0060;
    }

    if (lat === null || lng === null) {
        // Could not resolve location
        analyzeBtn.innerHTML = originalBtnContent;
        analyzeBtn.classList.remove('opacity-80', 'pointer-events-none');
        
        searchError.innerText = "Location not found. Please try a different city/area.";
        searchError.classList.remove('hidden', 'opacity-0');
        searchError.classList.add('animate-pulse');
        locationInput.parentElement.classList.add('border-rose-400', 'bg-rose-50');
        setTimeout(() => {
            locationInput.parentElement.classList.remove('border-rose-400', 'bg-rose-50');
            searchError.classList.remove('animate-pulse');
            setTimeout(() => { searchError.classList.add('hidden', 'opacity-0'); searchError.innerText = "Please enter a location or use GPS to continue."; }, 3000);
        }, 800);
        return;
    }

    // Reveal Dashboard
    dashboard.classList.remove('hidden');
    
    // Very slight delay before scroll up to let DOM render
    setTimeout(() => {
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Revert button
        analyzeBtn.innerHTML = originalBtnContent;
        analyzeBtn.classList.remove('opacity-80', 'pointer-events-none');
        
        // Initialize components
        initData(lat, lng);
    }, 100);
});

// Initialize dummy data and charts
function initData(lat, lng) {
    animateValues();
    initMap(lat, lng);
    initCharts();
    renderOpportunityCards();
}

function animateValues() {
    animateCounter(statTotalBiz, 0, 1248, 1500);
    animateCounterPercent(statSaturation, 0, 68, 1500);
    
    // Simulate thinking delay for top opportunity
    statTopOpp.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-slate-300"></i>';
    setTimeout(() => {
        statTopOpp.innerHTML = 'Specialty Coffee <span class="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded ml-1">Score: 92/100</span>';
    }, 1200);
}

function animateCounter(el, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function animateCounterPercent(el, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start) + "%";
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Leaflet Map Initialization
function initMap(lat, lng) {
    if (mapInstance) {
        mapInstance.remove();
    }
    
    // Fallbacks just in case
    lat = lat || 40.7128;
    lng = lng || -74.0060;
    
    mapInstance = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([lat, lng], 14);

    // Modern light tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(mapInstance);

    // High competition zones (Red Heat/Circles)
    const hotZones = [
        [lat + 0.005, lng - 0.008],
        [lat - 0.003, lng + 0.005],
        [lat + 0.008, lng + 0.002]
    ];
    hotZones.forEach(coord => {
        L.circle(coord, {
            color: '#f43f5e',
            fillColor: '#f43f5e',
            fillOpacity: 0.2,
            weight: 1,
            radius: 400
        }).addTo(mapInstance).bindPopup('<b style="color:#e11d48">Saturated Zone</b><br>High business density here.');
    });

    // Opportunity zones (Green Circles)
    const oppZones = [
        [lat + 0.012, lng - 0.002],
        [lat - 0.008, lng - 0.010],
        [lat - 0.005, lng + 0.012]
    ];
    oppZones.forEach((coord, i) => {
        // Glowing effect with SVG icon logic 
        L.circle(coord, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.3,
            weight: 2,
            radius: 300
        }).addTo(mapInstance).bindPopup(`<b style="color:#059669">Opportunity Gap #${i+1}</b><br>High demand, low supply detected.`);
    });
    
    // Some random existing business markers near the mapped location
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#0ea5e9; width:10px; height:10px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.3)'></div>",
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    for(let i=0; i<30; i++) {
        let rLat = lat + (Math.random() - 0.5) * 0.03;
        let rLng = lng + (Math.random() - 0.5) * 0.04;
        L.marker([rLat, rLng], {icon: customIcon}).addTo(mapInstance);
    }
}

// Chart.js Setup
function initCharts() {
    // Destroy previous if exist
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (demandChartInstance) demandChartInstance.destroy();

    // Category Doughnut
    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: ['Retail', 'Food & Bev', 'Services', 'Tech', 'Health'],
            datasets: [{
                data: [35, 25, 20, 10, 10],
                backgroundColor: [
                    '#0ea5e9', // brand-500
                    '#f43f5e', // rose-500
                    '#10b981', // emerald-500
                    '#8b5cf6', // violet-500
                    '#f59e0b'  // amber-500
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                }
            }
        }
    });

    // Demand vs Competition Bar
    const ctxDemand = document.getElementById('demandChart').getContext('2d');
    
    // Create gradients for bars
    let gradientOpp = ctxDemand.createLinearGradient(0, 0, 0, 300);
    gradientOpp.addColorStop(0, '#10b981'); // emerald
    gradientOpp.addColorStop(1, '#059669');
    
    let gradientComp = ctxDemand.createLinearGradient(0, 0, 0, 300);
    gradientComp.addColorStop(0, '#f43f5e'); // rose
    gradientComp.addColorStop(1, '#e11d48');

    demandChartInstance = new Chart(ctxDemand, {
        type: 'bar',
        data: {
            labels: ['Coffee', 'Pet Care', 'Fitness', 'Co-working', 'Vegan Food'],
            datasets: [
                {
                    label: 'Demand Proxy',
                    data: [95, 80, 60, 45, 88],
                    backgroundColor: gradientOpp,
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Competition',
                    data: [60, 30, 85, 50, 20],
                    backgroundColor: gradientComp,
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [4, 4], color: '#f1f5f9', drawBorder: false },
                    ticks: { display: false }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { family: "'Inter', sans-serif" } }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11 }}
                }
            }
        }
    });
}

function renderOpportunityCards() {
    const oppData = [
        {
            title: "Specialty Vegan Bakery",
            icon: "fa-leaf",
            category: "Food & Beverage",
            gapScore: 92,
            demand: "Very High",
            comp: "Low",
            desc: "Searches for 'vegan pastry' up 150% in this zone, but only 1 competitor within 3 miles.",
            color: "emerald"
        },
        {
            title: "Premium Pet Daycare",
            icon: "fa-paw",
            category: "Services",
            gapScore: 88,
            demand: "High",
            comp: "Low",
            desc: "High concentration of high-income apartments with pets; existing daycares are over capacity.",
            color: "brand"
        },
        {
            title: "Boutique Fitness Studio",
            icon: "fa-dumbbell",
            category: "Health & Fitness",
            gapScore: 76,
            demand: "Moderate",
            comp: "Moderate",
            desc: "Traditional gyms saturate the market, but niche studios (e.g., Pilates) have an unmet audience.",
            color: "violet"
        }
    ];

    const container = document.getElementById('opportunitiesContainer');
    container.innerHTML = '';
    
    // Map colors to Tailwind tail names
    const colorMap = {
        'emerald': { 
            bg: 'bg-emerald-50', text: 'text-emerald-600', grad: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/20',
            btnHover: 'hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'
        },
        'brand': { 
            bg: 'bg-brand-50', text: 'text-brand-600', grad: 'from-brand-500 to-brand-600', shadow: 'shadow-brand-500/20',
            btnHover: 'hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'
        },
        'violet': { 
            bg: 'bg-violet-50', text: 'text-violet-600', grad: 'from-violet-500 to-violet-600', shadow: 'shadow-violet-500/20',
            btnHover: 'hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700'
        }
    };

    oppData.forEach((opp, index) => {
        const colors = colorMap[opp.color];
        const cardDelay = (index * 0.15) + 0.9; // staggered animation delay
        
        const cardHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 hover:shadow-xl transition-all duration-300 opportunity-card group card-enter" style="animation-delay: ${cardDelay}s">
            <div class="flex justify-between items-start mb-6">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.grad} flex items-center justify-center text-white text-xl shadow-lg ${colors.shadow} group-hover:scale-110 transition-transform duration-300">
                    <i class="fa-solid ${opp.icon}"></i>
                </div>
                <!-- Circular Score Chart -->
                <div class="relative w-14 h-14 rounded-full flex items-center justify-center bg-slate-50 border-4 border-slate-100">
                    <svg viewBox="0 0 36 36" class="absolute w-full h-full -rotate-90 stroke-current ${colors.text} drop-shadow-sm">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3" stroke-dasharray="${opp.gapScore}, 100" stroke-linecap="round"/>
                    </svg>
                    <span class="font-heading font-bold text-slate-800 text-sm">${opp.gapScore}</span>
                </div>
            </div>
            
            <div class="mb-5">
                <span class="text-xs font-bold uppercase tracking-wider ${colors.text} mb-1 block">${opp.category}</span>
                <h3 class="text-xl font-heading font-bold text-slate-900 leading-tight">${opp.title}</h3>
            </div>
            
            <p class="text-slate-500 text-sm mb-6 leading-relaxed">
                ${opp.desc}
            </p>
            
            <div class="bg-slate-50 rounded-xl p-4 flex justify-between items-center mb-6">
                <div>
                    <p class="text-[10px] uppercase font-bold text-slate-400 mb-1">Demand Propensity</p>
                    <p class="text-sm font-bold text-slate-800 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${opp.demand}</p>
                </div>
                <div class="w-px h-8 bg-slate-200"></div>
                <div>
                    <p class="text-[10px] uppercase font-bold text-slate-400 mb-1">Competition</p>
                    <p class="text-sm font-bold text-slate-800 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${opp.comp}</p>
                </div>
            </div>
            
            <button class="w-full py-3 rounded-xl border-2 border-slate-100 font-semibold text-slate-700 ${colors.btnHover} transition-all flex justify-center items-center gap-2 group-hover:border-slate-200">
                Generate Business Plan <i class="fa-solid fa-arrow-right text-sm"></i>
            </button>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}
