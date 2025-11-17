// Complete User Dashboard Script

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Assuming token is named 'authToken'
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Assumes you have an AuthAPI similar to the admin side
        const user = await AuthAPI.getCurrentUser(); 
        
        // IMPORTANT: This security check ensures only 'passenger' roles can see this page.
        if (user.role !== 'passenger') {
            await Swal.fire('Access Denied', 'You do not have permission to view this page.', 'error');
            AuthAPI.logout(); // Logs out the non-passenger user
            return;
        }
        
        // Populate user details in the header
        document.getElementById('user-name-display').textContent = user.name || 'Passenger';
        document.getElementById('user-email-display').textContent = user.email;
        const userAvatar = document.getElementById('user-avatar');
        if (user.name) {
            userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff`;
        }

        // Load the initial data for the user's dashboard view
        await loadUserDashboard();
        initializeBookingForm();

    } catch (error) {
        console.error('Authentication error:', error);
        AuthAPI.logout(); // If token is invalid, log out
    }
});

// --- NAVIGATION ---
function switchView(view) {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`${view}-section`).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[onclick="switchView('${view}')"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        document.getElementById('page-title').textContent = activeItem.textContent.trim();
    }

    // Load data for the specific view when switched to
    if (view === 'history') {
        loadBookingHistory();
    }
    if (view === 'profile') {
        loadProfile();
    }
}

// --- DROPDOWN TOGGLE ---
function toggleDropdown() {
    document.getElementById('user-dropdown').classList.toggle('active');
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const button = dropdown.previousElementSibling;
    if (dropdown && !dropdown.contains(e.target) && button && !button.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// --- DATA LOADING ---

// Loads the main dashboard view (next flight, recent bookings)
// In user_dashboard.js, replace the old loadUserDashboard function with this one

async function loadUserDashboard() {
    try {
        const myBookings = await BookingsAPI.getMyBookings(); 

        const nextFlightCard = document.getElementById('next-flight-card');
        const recentBookingsList = document.getElementById('recent-bookings-list');
        nextFlightCard.innerHTML = '<p class="text-blue-100">No upcoming flights found.</p>';
        recentBookingsList.innerHTML = '<p class="text-sm text-slate-500">You have no recent bookings.</p>';

        if (myBookings.length > 0) {
            // Find the next upcoming flight (now using the flat structure)
            const upcomingFlights = myBookings
                .filter(b => new Date(b.departure_at) > new Date())
                .sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at));

            if (upcomingFlights.length > 0) {
                const nextFlight = upcomingFlights[0]; // The booking object now contains the flight info directly
                nextFlightCard.innerHTML = `
                    <p class="text-xl font-semibold">${nextFlight.flight_number}: ${nextFlight.from_airport} → ${nextFlight.to_airport}</p>
                    <p class="text-blue-200 mt-1">Departing: ${new Date(nextFlight.departure_at).toLocaleString()}</p>
                `;
            }

            // Display recent bookings (now using the flat structure)
            recentBookingsList.innerHTML = '';
            myBookings.slice(0, 3).forEach(booking => {
                recentBookingsList.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p class="font-semibold text-slate-800">${booking.flight_number}</p>
                            <p class="text-sm text-slate-500">${booking.from_airport} → ${booking.to_airport}</p>
                        </div>
                        <span class="status-badge ${getStatusClass(booking.status)}">${booking.status}</span>
                    </div>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading user dashboard data:', error);
    }
}
// Loads the table in the "Booking History" page
async function loadBookingHistory() {
    try {
        const myBookings = await BookingsAPI.getMyBookings();
        const tableBody = document.getElementById('history-table-body');
        tableBody.innerHTML = '';

        if (myBookings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No booking history found.</td></tr>';
            return;
        }

        myBookings.forEach(booking => {
    tableBody.innerHTML += `
        <tr class="bg-white border-b hover:bg-slate-50">
            <td class="px-6 py-4 font-medium text-slate-900">${booking.flight_number}</td>
            <td class="px-6 py-4">${booking.from_airport} → ${booking.to_airport}</td>
            <td class="px-6 py-4">${new Date(booking.departure_at).toLocaleDateString()}</td>
            <td class="px-6 py-4"><span class="status-badge ${getStatusClass(booking.status)}">${booking.status}</span></td>
            <td class="px-6 py-4 text-right">
                <button onclick="viewBookingDetails(${booking.id})" class="font-medium text-blue-600 hover:underline">Details</button>
            </td>
        </tr>
    `;
});
    } catch (error) {
        console.error('Error loading booking history:', error);
    }
}

// Sets up the flight search form
function initializeBookingForm() {
    const form = document.getElementById('search-flight-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const from = document.getElementById('from-airport').value;
        const to = document.getElementById('to-airport').value;
        const date = document.getElementById('departure-date').value;

        try {
            // NOTE: You will need a search endpoint in your Flights API.
            const results = await FlightsAPI.getAll({ from, to, date });
            const resultsContainer = document.getElementById('flight-search-results');
            resultsContainer.innerHTML = '';

            if (results.length === 0) {
                resultsContainer.innerHTML = '<p class="text-center text-slate-500">No flights found for your search.</p>';
                return;
            }

            results.forEach(flight => {
                resultsContainer.innerHTML += `
                    <div class="border rounded-lg p-4 mb-4 flex justify-between items-center">
                        <div>
                            <p class="font-bold text-lg">${flight.flight_number}</p>
                            <p class="text-slate-700">${flight.from_airport} → ${flight.to_airport}</p>
                            <p class="text-sm text-slate-500">Departs: ${new Date(flight.departure_at).toLocaleString()}</p>
                        </div>
                        <button onclick="confirmBooking('${flight.flight_number}')" class="btn-primary">Book Now</button>
                    </div>
                `;
            });

        } catch (error) {
            console.error('Error searching flights:', error);
            Swal.fire('Error', 'Could not perform flight search.', 'error');
        }
    });
}

// Handles the "Book Now" button click
async function confirmBooking(flightNumber) {
    const { isConfirmed } = await Swal.fire({
        title: 'Confirm Your Booking',
        text: `Are you sure you want to book a seat on flight ${flightNumber}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Book It!',
        confirmButtonColor: '#1e40af'
    });

    if (isConfirmed) {
        try {
            // NOTE: You will need a create booking endpoint.
            await BookingsAPI.create({ flightNumber });
            await Swal.fire('Success!', 'Your flight has been booked successfully.', 'success');
            // Refresh dashboard data to show the new booking
            loadUserDashboard(); 
            switchView('dashboard');
        } catch (error) {
            Swal.fire('Booking Failed', error.message, 'error');
        }
    }
}


// Loads the user's info into the profile page
async function loadProfile() {
    try {
        const user = await AuthAPI.getCurrentUser();
        document.getElementById('profile-name').textContent = user.name || 'Not Set';
        document.getElementById('profile-email').textContent = user.email;
    } catch (error) {
        console.error('Could not load profile:', error);
    }
}

// --- UTILITIES ---
function getStatusClass(status) {
    const statusMap = {
        'confirmed': 'status-confirmed',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled',
        'pending': 'bg-yellow-100 text-yellow-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
}

// --- LOGOUT ---
function logout() {
    AuthAPI.logout();
}