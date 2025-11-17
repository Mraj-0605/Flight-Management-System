// crew-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let currentUser;
    try {
        currentUser = await AuthAPI.getCurrentUser();
        
        if (currentUser.role !== 'crew') {
            await Swal.fire('Access Denied', 'This dashboard is for crew members only.', 'error');
            AuthAPI.logout();
            return;
        }
        
        // Populate user info in header and info card
        document.getElementById('user-name-display').textContent = currentUser.name || currentUser.email;
        document.getElementById('user-role-display').textContent = currentUser.crew_type || 'Crew';
        document.getElementById('user-email-dropdown').textContent = currentUser.email;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'Crew')}&background=3b82f6&color=fff`;
        document.getElementById('welcome-message').textContent = `Welcome, ${currentUser.name}!`;

        document.getElementById('info-name').textContent = currentUser.name;
        document.getElementById('info-email').textContent = currentUser.email;
        document.getElementById('info-role').textContent = currentUser.crew_type || 'N/A';
        document.getElementById('info-status').textContent = currentUser.status || 'Active';
        
        await loadMySchedule(currentUser);

    } catch (error) {
        console.error('Authentication error:', error);
        AuthAPI.logout();
    }
    
    // Calendar Navigation
    let currentDate = new Date();
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), currentUser);
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), currentUser);
    });
});

// --- DATA LOADING & FILTERING ---
async function loadMySchedule(currentUser) {
    try {
        const allFlights = await FlightsAPI.getAll();
        const myFlights = allFlights.filter(flight => {
            const manifest = flight.crew_manifest || {};
            for (const assignment of Object.values(manifest)) {
                if (!assignment) continue;

                if (Array.isArray(assignment)) { // Ground staff roles
                    if (assignment.some(member => member && member.email === currentUser.email)) {
                        return true;
                    }
                } else if (typeof assignment === 'object' && assignment.email === currentUser.email) { // In-flight roles
                    return true;
                }
            }
            return false;
        });
        
        // Sort flights by departure time, soonest first
        myFlights.sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at));

        populateUpcomingFlights(myFlights);
        
        // Initialize calendar with current month
        const today = new Date();
        await generateCalendar(today.getFullYear(), today.getMonth(), currentUser, myFlights);

    } catch (error) {
        console.error("Failed to load schedule:", error);
        Swal.fire('Error', 'Could not load your flight schedule.', 'error');
    }
}

// --- UI POPULATION ---
function populateUpcomingFlights(myFlights) {
    const upcomingList = document.getElementById('upcoming-flights-list');
    upcomingList.innerHTML = '';
    
    const now = new Date();
    const futureFlights = myFlights.filter(f => new Date(f.departure_at) > now);

    if (futureFlights.length === 0) {
        upcomingList.innerHTML = '<p class="text-slate-500 text-sm">No upcoming flights found.</p>';
        return;
    }

    futureFlights.slice(0, 5).forEach(flight => {
        upcomingList.innerHTML += `
            <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-blue-400">
                <p class="font-semibold text-slate-800">${flight.flight_number}: ${flight.from_airport} → ${flight.to_airport}</p>
                <p class="text-sm text-slate-600">${new Date(flight.departure_at).toLocaleString()}</p>
            </div>
        `;
    });
}

// --- CALENDAR ---
async function generateCalendar(year, month, currentUser, myFlights = null) {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    calendarGrid.innerHTML = 'Loading...'; // Show loading state

    // If flights aren't passed, fetch them
    if (myFlights === null) {
         try {
             const allFlights = await FlightsAPI.getAll();
             myFlights = allFlights.filter(flight => {
                 const manifest = flight.crew_manifest || {};
                 for (const assignment of Object.values(manifest)) {
                     if (!assignment) continue;
                     if (Array.isArray(assignment)) {
                         if (assignment.some(member => member && member.email === currentUser.email)) return true;
                     } else if (typeof assignment === 'object' && assignment.email === currentUser.email) {
                         return true;
                     }
                 }
                 return false;
             });
         } catch(error) {
             calendarGrid.innerHTML = 'Error loading flights.';
             return;
         }
    }

    calendarGrid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    monthYearEl.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    const flightsInMonth = myFlights.filter(f => {
        const departure = new Date(f.departure_at);
        const arrival = new Date(f.arrival_at);
        return departure <= monthEnd && arrival >= monthStart;
    });
    
    const flightsByDay = {};
    flightsInMonth.forEach(flight => {
        const departureDate = new Date(flight.departure_at);
        const dayOfMonth = departureDate.getDate();
        if (departureDate.getFullYear() === year && departureDate.getMonth() === month) {
            if (!flightsByDay[dayOfMonth]) flightsByDay[dayOfMonth] = [];
            flightsByDay[dayOfMonth].push(flight);
        }
    });
    
    for (let i = 0; i < firstDay.getDay(); i++) {
        calendarGrid.innerHTML += `<div class="calendar-day other-month"></div>`;
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        let dayHtml = `<div class="calendar-day">
                            <div class="calendar-day-header">${day}</div>
                            <div class="space-y-1">`;
        if (flightsByDay[day]) {
            flightsByDay[day].forEach(flight => {
                dayHtml += `<div class="flight-event" onclick='showFlightDetails(${JSON.stringify(flight)}, "${currentUser.email}")'>
                                <p class="font-bold">${flight.flight_number}</p>
                                <p class="text-xs">${flight.from_airport} → ${flight.to_airport}</p>
                            </div>`;
            });
        }
        dayHtml += `</div></div>`;
        calendarGrid.innerHTML += dayHtml;
    }
}

function showFlightDetails(flight, userEmail) {
    const manifest = flight.crew_manifest || {};
    let myRole = 'N/A';
    let myWorkTime = 'N/A';
    let myLocation = 'N/A';

    // Find the current user in the manifest to get their specific details
    for (const [key, assignment] of Object.entries(manifest)) {
        if (!assignment) continue;
        if (Array.isArray(assignment)) {
            const myAssignment = assignment.find(a => a && a.email === userEmail);
            if (myAssignment) {
                myRole = key; // Role key from manifest
                myWorkTime = `${myAssignment.startTime} - ${myAssignment.endTime}`;
                myLocation = `${myAssignment.airport} (${myAssignment.location})`;
                break;
            }
        } else if (typeof assignment === 'object' && assignment.email === userEmail) {
            myRole = key;
            myWorkTime = `${assignment.startTime} - ${assignment.endTime}`;
            myLocation = `In-Flight`;
            break;
        }
    }

    Swal.fire({
        title: `Flight: ${flight.flight_number}`,
        html: `
            <div class="text-left space-y-3 p-2 bg-slate-50 rounded-lg">
                <p><strong>Route:</strong> ${flight.from_airport} → ${flight.to_airport}</p>
                <p><strong>Departure:</strong> ${new Date(flight.departure_at).toLocaleString()}</p>
                <p><strong>Arrival:</strong> ${new Date(flight.arrival_at).toLocaleString()}</p>
                <p><strong>Aircraft:</strong> ${flight.assigned_aircraft || 'N/A'}</p>
                <hr class="my-3"/>
                <h4 class="font-bold text-blue-700">Your Assignment Details</h4>
                <p><strong>Your Role:</strong> ${myRole.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p><strong>Work Hours:</strong> ${myWorkTime}</p>
                <p><strong>Location:</strong> ${myLocation}</p>
            </div>
        `,
        confirmButtonColor: '#1e40af'
    });
}

// --- UTILITIES ---
function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('active');
}

// Close dropdown if clicked outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const button = dropdown.previousElementSibling;
    if (dropdown && !dropdown.contains(e.target) && button && !button.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

function logout() {
    AuthAPI.logout();
}