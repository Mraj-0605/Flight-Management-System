// Complete PostgreSQL Integration Script - FINAL CORRECTED VERSION

// --- CREW ROLE DEFINITIONS ---
const IN_FLIGHT_ROLES = {
    pilot: { label: 'Pilot' },
    copilot: { label: 'Co-pilot' },
    cabinCrewManager: { label: 'Cabin Crew Manager' },
    cabinCrew1: { label: 'Cabin Crew 1' },
    cabinCrew2: { label: 'Cabin Crew 2' },
    cabinCrew3: { label: 'Cabin Crew 3' },
    cabinCrew4: { label: 'Cabin Crew 4' },
    cabinCrew5: { label: 'Cabin Crew 5' },
    cabinCrew6: { label: 'Cabin Crew 6' },
    cabinCrew7: { label: 'Cabin Crew 7' },
};

const GROUND_STAFF_ROLES = {
    customerService: { label: 'Customer Service Rep' },
    baggageHandler: { label: 'Baggage Handler' },
    securityOfficer: { label: 'Security Officer' },
    maintenanceCrew: { label: 'Maintenance Crew' },
    ticketingAgent: { label: 'Ticketing Agent' },
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = await AuthAPI.getCurrentUser();
        
        if (user.role !== 'admin') {
            await Swal.fire('Access Denied', 'You do not have permission to view this page.', 'error');
            AuthAPI.logout();
            return;
        }
        
        document.getElementById('user-email-display').textContent = user.email;
        document.getElementById('user-email-dropdown').textContent = user.email;
        await loadAllData();
    } catch (error) {
        console.error('Auth error:', error);
        AuthAPI.logout();
    }
    
    let currentDate = new Date();
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
});

async function loadAllData() {
    try {
        await Promise.all([
            loadStats(),
            loadFlights(),
            loadFleet(),
            loadInvites(),
            loadCrew(),
            loadBookings()
        ]);
    } catch (error) {
        console.error('Error loading data:', error);
        Swal.fire('Error', 'Failed to load dashboard data', 'error');
    }
}

// --- NAVIGATION ---
function switchView(view) {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`${view}-section`).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active', 'bg-slate-700', 'text-white');
    });
    const activeItem = document.querySelector(`.nav-item[onclick="switchView('${view}')"]`);
    if (activeItem) {
        activeItem.classList.add('active', 'bg-slate-700', 'text-white');
        document.getElementById('page-title').textContent = activeItem.textContent.trim();
    }

    if (view === 'scheduling') {
        generateCalendar(new Date().getFullYear(), new Date().getMonth());
    }
    if (view === 'analytics') {
        loadAnalytics();
    }
}

// --- DROPDOWN TOGGLE ---
function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('active');
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const button = dropdown.previousElementSibling;
    if (dropdown && !dropdown.contains(e.target) && button && !button.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// --- STATS ---
async function loadStats() {
    try {
        const stats = await StatsAPI.getStats();
        
        document.getElementById('total-flights').textContent = stats.totalFlights;
        document.getElementById('total-fleet').textContent = stats.totalFleet;
        document.getElementById('total-crew').textContent = stats.totalCrew;
        document.getElementById('total-invites').textContent = stats.totalInvites;

        const recentFlights = await FlightsAPI.getAll({ limit: 5 });
        const recentFlightsList = document.getElementById('recent-flights-list');
        recentFlightsList.innerHTML = '';
        
        if (recentFlights.length === 0) {
            recentFlightsList.innerHTML = '<p class="text-slate-400 text-sm">No flights scheduled</p>';
        } else {
            recentFlights.forEach(flight => {
                recentFlightsList.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p class="font-semibold text-slate-800">${flight.flight_number}</p>
                            <p class="text-sm text-slate-500">${flight.from_airport} → ${flight.to_airport}</p>
                        </div>
                        <span class="text-xs font-medium px-2 py-1 rounded-full ${getStatusClass(flight.status)}">${flight.status}</span>
                    </div>
                `;
            });
        }

        const fleet = await FleetAPI.getAll();
        const fleetStatusList = document.getElementById('fleet-status-list');
        fleetStatusList.innerHTML = '';
        
        if (fleet.length === 0) {
            fleetStatusList.innerHTML = '<p class="text-slate-400 text-sm">No aircraft in fleet</p>';
        } else {
            fleet.slice(0, 5).forEach(aircraft => {
                fleetStatusList.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p class="font-semibold text-slate-800">${aircraft.tail_number}</p>
                            <p class="text-sm text-slate-500">${aircraft.model}</p>
                        </div>
                        <span class="text-xs font-medium px-2 py-1 rounded-full ${getStatusClass(aircraft.status)}">${aircraft.status}</span>
                    </div>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function getStatusClass(status) {
    const statusMap = {
        'Active': 'bg-green-100 text-green-800',
        'On Time': 'bg-green-100 text-green-800',
        'Scheduled': 'bg-blue-100 text-blue-800',
        'Delayed': 'bg-yellow-100 text-yellow-800',
        'Cancelled': 'bg-red-100 text-red-800',
        'Maintenance': 'bg-orange-100 text-orange-800',
        'Grounded': 'bg-gray-100 text-gray-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'accepted': 'bg-green-100 text-green-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
}

// --- FLEET MANAGEMENT ---
async function loadFleet() {
    try {
        const fleet = await FleetAPI.getAll();
        const tableBody = document.getElementById('fleet-table-body');
        tableBody.innerHTML = '';
        
        if (fleet.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">No aircraft in fleet</td></tr>';
            return;
        }
        
        fleet.forEach(aircraft => {
            tableBody.innerHTML += `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="px-6 py-4 font-medium text-slate-900">${aircraft.tail_number}</td>
                    <td class="px-6 py-4">${aircraft.model}</td>
                    <td class="px-6 py-4">${aircraft.capacity}</td>
                    <td class="px-6 py-4"><span class="status-badge ${getStatusClass(aircraft.status)}">${aircraft.status}</span></td>
                    <td class="px-6 py-4 text-right space-x-2">
                        <button onclick="showAddEditFleetModal(${aircraft.id})" class="font-medium text-blue-600 hover:underline">Edit</button>
                        <button onclick="deleteFleet(${aircraft.id})" class="font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading fleet:', error);
    }
}

async function showAddEditFleetModal(fleetId = null) {
    let existingData = {};
    if (fleetId) {
        existingData = await FleetAPI.getById(fleetId);
    }
    
    const { value: formValues } = await Swal.fire({
        title: fleetId ? 'Edit Aircraft' : 'Add New Aircraft',
        html: `
            <input id="swal-tailNumber" class="modal-input mt-2" placeholder="Tail Number (e.g., N12345)" value="${existingData.tail_number || ''}">
            <input id="swal-model" class="modal-input mt-2" placeholder="Aircraft Model (e.g., Boeing 737)" value="${existingData.model || ''}">
            <input id="swal-capacity" type="number" class="modal-input mt-2" placeholder="Passenger Capacity" value="${existingData.capacity || ''}">
            <select id="swal-status" class="modal-input mt-2">
                <option value="Active" ${existingData.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Maintenance" ${existingData.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                <option value="Grounded" ${existingData.status === 'Grounded' ? 'selected' : ''}>Grounded</option>
            </select>
        `,
        confirmButtonText: 'Save',
        showCancelButton: true,
        confirmButtonColor: '#1e40af',
        preConfirm: () => {
            const data = {
                tailNumber: document.getElementById('swal-tailNumber').value.trim(),
                model: document.getElementById('swal-model').value.trim(),
                capacity: parseInt(document.getElementById('swal-capacity').value),
                status: document.getElementById('swal-status').value
            };
            if (!data.tailNumber || !data.model || !data.capacity) {
                Swal.showValidationMessage('Please fill all fields');
                return false;
            }
            return data;
        }
    });

    if (formValues) {
        try {
            if (fleetId) {
                await FleetAPI.update(fleetId, formValues);
            } else {
                await FleetAPI.create(formValues);
            }
            await Swal.fire('Success!', `Aircraft ${fleetId ? 'updated' : 'added'} successfully.`, 'success');
            loadFleet();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function deleteFleet(fleetId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This will permanently delete this aircraft!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, delete it!'
    });

    if (isConfirmed) {
        try {
            await FleetAPI.delete(fleetId);
            await Swal.fire('Deleted!', 'Aircraft has been removed.', 'success');
            loadFleet();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- FLIGHT MANAGEMENT ---
async function loadFlights() {
    try {
        const flights = await FlightsAPI.getAll();
        const tableBody = document.getElementById('flights-table-body');
        tableBody.innerHTML = '';
        
        if (flights.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-slate-400">No flights scheduled</td></tr>';
            return;
        }
        
        flights.forEach(flight => {
            tableBody.innerHTML += `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="px-6 py-4 font-medium text-slate-900">${flight.flight_number}</td>
                    <td class="px-6 py-4">${flight.from_airport} → ${flight.to_airport}</td>
                    <td class="px-6 py-4">
                        <div class="text-sm">Depart: ${new Date(flight.departure_at).toLocaleString()}</div>
                        <div class="text-xs text-slate-500">Arrive: ${new Date(flight.arrival_at).toLocaleString()}</div>
                    </td>
                    <td class="px-6 py-4">${flight.assigned_aircraft || 'N/A'}</td>
                    <td class="px-6 py-4"><span class="status-badge ${getStatusClass(flight.status)}">${flight.status}</span></td>
                    <td class="px-6 py-4 text-right space-x-2">
                        <button onclick="openCrewManager(${flight.id})" class="font-medium text-purple-600 hover:underline">Crew</button>
                        <button onclick="showAddEditFlightModal(${flight.id})" class="font-medium text-blue-600 hover:underline">Edit</button>
                        <button onclick="deleteFlight(${flight.id})" class="font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading flights:', error);
    }
}

async function showAddEditFlightModal(flightId = null) {
    let existingData = {};
    if (flightId) {
        existingData = await FlightsAPI.getById(flightId);
    }
    
    const fleet = await FleetAPI.getAll();
    const activeFleet = fleet.filter(a => a.status === 'Active');
    let fleetOptions = '<option value="">Assign Aircraft</option>';
    activeFleet.forEach(aircraft => {
        fleetOptions += `<option value="${aircraft.tail_number}" ${existingData.assigned_aircraft === aircraft.tail_number ? 'selected' : ''}>${aircraft.tail_number} (${aircraft.model})</option>`;
    });
    
    // Helper function to format dates for datetime-local input, handling timezones
    const formatForInput = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Adjust for timezone offset before converting to ISO string
        const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    };

    const { value: formValues } = await Swal.fire({
        title: flightId ? 'Edit Flight' : 'Add New Flight',
        html: `
            <div class="grid grid-cols-1 gap-4 text-left">
                <input id="swal-flightNumber" class="modal-input" placeholder="Flight Number" value="${existingData.flight_number || ''}">
                
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Departure</label>
                    <input id="swal-departure" type="datetime-local" class="modal-input" value="${formatForInput(existingData.departure_at)}">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Arrival</label>
                    <input id="swal-arrival" type="datetime-local" class="modal-input" value="${formatForInput(existingData.arrival_at)}">
                </div>

                <input id="swal-from" class="modal-input" placeholder="Origin (e.g., JFK)" value="${existingData.from_airport || ''}">
                <input id="swal-to" class="modal-input" placeholder="Destination (e.g., LAX)" value="${existingData.to_airport || ''}">
                
                <select id="swal-aircraft" class="modal-input">${fleetOptions}</select>
                <select id="swal-flight-status" class="modal-input">
                    <option value="Scheduled" ${existingData.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="On Time" ${existingData.status === 'On Time' ? 'selected' : ''}>On Time</option>
                    <option value="Delayed" ${existingData.status === 'Delayed' ? 'selected' : ''}>Delayed</option>
                    <option value="Cancelled" ${existingData.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
        `,
        width: '600px',
        confirmButtonText: 'Save',
        showCancelButton: true,
        confirmButtonColor: '#1e40af',
        preConfirm: () => {
            const data = {
                flightNumber: document.getElementById('swal-flightNumber').value.trim(),
                from: document.getElementById('swal-from').value.trim(),
                to: document.getElementById('swal-to').value.trim(),
                departure_at: document.getElementById('swal-departure').value,
                arrival_at: document.getElementById('swal-arrival').value,
                assignedAircraft: document.getElementById('swal-aircraft').value,
                status: document.getElementById('swal-flight-status').value,
            };
            if (!data.flightNumber || !data.from || !data.to || !data.departure_at || !data.arrival_at) {
                Swal.showValidationMessage('Please fill all required fields');
                return false;
            }
            return data;
        }
    });

    if (formValues) {
        try {
            if (flightId) {
                await FlightsAPI.update(flightId, formValues);
            } else {
                await FlightsAPI.create(formValues);
            }
            await Swal.fire('Success!', `Flight ${flightId ? 'updated' : 'added'} successfully.`, 'success');
            loadFlights();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function deleteFlight(flightId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This will permanently delete this flight!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, delete it!'
    });

    if (isConfirmed) {
        try {
            await FlightsAPI.delete(flightId);
            await Swal.fire('Deleted!', 'Flight has been removed.', 'success');
            loadFlights();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- CREW SCHEDULING & CALENDAR ---
async function generateCalendar(year, month) {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    calendarGrid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    monthYearEl.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    try {
        const allFlights = await FlightsAPI.getAll();
        
        const flightsInMonth = allFlights.filter(f => {
            const departure = new Date(f.departure_at);
            const arrival = new Date(f.arrival_at);
            return departure <= monthEnd && arrival >= monthStart;
        });
        
        const flightsByDay = {};
        flightsInMonth.forEach(flight => {
            const departureDate = new Date(flight.departure_at);
            const arrivalDate = new Date(flight.arrival_at);
            let loopDate = new Date(departureDate);
            loopDate.setHours(0, 0, 0, 0); // Normalize to start of day

            while (loopDate <= arrivalDate) {
                if (loopDate.getFullYear() === year && loopDate.getMonth() === month) {
                    const dayOfMonth = loopDate.getDate();
                    if (!flightsByDay[dayOfMonth]) flightsByDay[dayOfMonth] = [];
                    flightsByDay[dayOfMonth].push(flight);
                }
                loopDate.setDate(loopDate.getDate() + 1);
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
                    dayHtml += `<div class="flight-event" onclick="openCrewManager(${flight.id})">
                                    <p class="font-bold">${flight.flight_number}</p>
                                    <p class="text-xs">${flight.from_airport} → ${flight.to_airport}</p>
                                    <p class="text-xs">
                                        ${new Date(flight.departure_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                        ${new Date(flight.arrival_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>`;
                });
            }
            dayHtml += `</div></div>`;
            calendarGrid.innerHTML += dayHtml;
        }
    } catch (error) {
        console.error('Error generating calendar:', error);
    }
}

async function openCrewManager(flightId) {
    try {
        const flight = await FlightsAPI.getById(flightId);
        const manifest = flight.crew_manifest || {};

        const generateRoleHtml = (roles, isMultiple) => {
            return Object.entries(roles).map(([key, role]) => {
                const assigned = manifest[key];
                let assignedHtml = '';
                
                if (!isMultiple) {
                    if (assigned && typeof assigned === 'object' && assigned.email) {
                        assignedHtml = `<div class="flex flex-col items-end gap-1">
                                <div class="flex items-center gap-2 font-semibold text-sm bg-green-50 px-3 py-2 rounded-lg">
                                    <div class="text-left">
                                        <div class="text-green-700 font-bold">${assigned.email}</div>
                                        <div class="text-xs text-green-600">⏰ Working: ${assigned.startTime} - ${assigned.endTime}</div>
                                        <div class="text-xs text-green-600">📍 Full Flight Duration</div>
                                    </div>
                                    <button onclick="unassignCrew(${flightId}, '${key}', '${assigned.email}', false)" class="text-red-500 hover:text-red-700 text-lg">×</button>
                                </div>
                            </div>`;
                    } else {
                        assignedHtml = `<button onclick="assignCrew(${flightId}, '${key}', '${role.label}', false)" class="text-blue-600 hover:underline text-sm">+ Assign</button>`;
                    }
                } else {
                    const staffList = (assigned || []).map(staffMember => {
                        if (typeof staffMember === 'object' && staffMember.email) {
                            return `<div class="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg text-xs">
                                    <div class="text-left">
                                        <div class="font-bold text-slate-800">${staffMember.email}</div>
                                        <div class="text-slate-600">⏰ ${staffMember.startTime} - ${staffMember.endTime}</div>
                                        <div class="text-slate-600">📍 ${staffMember.airport} (${staffMember.location})</div>
                                    </div>
                                    <button onclick="unassignCrew(${flightId}, '${key}', '${staffMember.email}', true)" class="text-red-500 hover:text-red-700 text-lg">×</button>
                                  </div>`;
                        }
                        return '';
                    }).join('');
                    assignedHtml = `<div class="flex flex-col items-end gap-1">
                                        ${staffList}
                                        <button onclick="assignCrew(${flightId}, '${key}', '${role.label}', true)" class="text-blue-600 hover:underline text-sm mt-1">+ Add</button>
                                    </div>`;
                }
                
                return `<div class="p-3 border-b flex justify-between items-center">
                            <span class="text-slate-700 font-medium text-sm">${role.label}</span>
                            ${assignedHtml}
                        </div>`;
            }).join('');
        };
        
        Swal.fire({
            title: `Crew Assignment - ${flight.flight_number}`,
            html: `
                <div class="text-left max-h-[70vh] overflow-y-auto p-1">
                    <div class="bg-blue-50 p-3 rounded-lg mb-4">
                        <p class="text-sm"><strong>Route:</strong> ${flight.from_airport} → ${flight.to_airport}</p>
                        <p class="text-sm"><strong>Departure:</strong> ${new Date(flight.departure_at).toLocaleString()}</p>
                        <p class="text-sm"><strong>Arrival:</strong> ${new Date(flight.arrival_at).toLocaleString()}</p>
                    </div>
                    <h3 class="font-bold text-lg text-slate-800 mt-4 mb-2">✈️ In-Flight Crew</h3>
                    <p class="text-xs text-slate-500 mb-2">Crew will be scheduled for the full flight duration.</p>
                    <div class="border rounded-lg bg-white">${generateRoleHtml(IN_FLIGHT_ROLES, false)}</div>
                    <h3 class="font-bold text-lg text-slate-800 mt-4 mb-2">🔧 Ground Staff</h3>
                    <p class="text-xs text-slate-500 mb-2">Staff are scheduled for 1 hour shifts.</p>
                    <div class="border rounded-lg bg-white">${generateRoleHtml(GROUND_STAFF_ROLES, true)}</div>
                </div>
            `,
            width: '900px',
            showConfirmButton: false,
            showCloseButton: true,
        });
    } catch (error) {
        console.error('Error opening crew manager:', error);
        Swal.fire('Error', 'Failed to load crew assignment', 'error');
    }
}

window.assignCrew = async (flightId, roleKey, roleLabel, isMultiple) => {
    try {
        const allCrew = await CrewAPI.getAll();
        
        if (allCrew.length === 0) {
            Swal.fire('No Crew Available', 'Please add crew members first.', 'warning');
            return;
        }
        
        const inputOptions = {};
        allCrew.forEach(crew => {
            inputOptions[crew.email] = `${crew.name || crew.email} (${crew.crew_type || 'Crew'})`;
        });
        
        const flight = await FlightsAPI.getById(flightId);
        
        let scheduleHtml = '';
        if (isMultiple) {
            scheduleHtml = `
                <div class="mt-4 p-4 bg-blue-50 rounded-lg text-left">
                    <label class="block text-sm font-semibold text-slate-700 mb-2">Assign Location:</label>
                    <select id="swal-location" class="modal-input">
                        <option value="departure">Departure Airport (${flight.from_airport})</option>
                        <option value="arrival">Arrival Airport (${flight.to_airport})</option>
                    </select>
                    <p class="text-xs text-slate-600 mt-2">Staff will be scheduled 45 minutes before their event.</p>
                </div>
            `;
        } else {
            scheduleHtml = `
                <div class="mt-4 p-4 bg-green-50 rounded-lg text-left">
                    <p class="text-sm text-green-700">✈️ This crew member will be scheduled for the full flight duration.</p>
                    <p class="text-xs text-green-600 mt-1">
                        Working hours: 
                        ${new Date(flight.departure_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to 
                        ${new Date(flight.arrival_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
            `;
        }
        
        const { value: formValues } = await Swal.fire({
            title: `Assign ${roleLabel}`,
            html: `
                <label class="block text-left text-sm font-semibold text-slate-700 mb-2">Select Crew Member:</label>
                <select id="swal-crew-select" class="modal-input">
                    <option value="">Choose a crew member...</option>
                    ${Object.entries(inputOptions).map(([email, name]) => `<option value="${email}">${name}</option>`).join('')}
                </select>
                ${scheduleHtml}
            `,
            showCancelButton: true,
            confirmButtonColor: '#1e40af',
            confirmButtonText: 'Assign Crew',
            width: '600px',
            preConfirm: () => {
                const email = document.getElementById('swal-crew-select').value;
                if (!email) {
                    Swal.showValidationMessage('Please select a crew member');
                    return false;
                }
                
                const result = { email };
                if (isMultiple) {
                    result.location = document.getElementById('swal-location').value;
                }
                return result;
            }
        });
        
        if (!formValues) return;
        
        const email = formValues.email;
        const conflictingFlight = await checkCrewConflict(email, flight.departure_at, flight.arrival_at, flightId);
        
        if (conflictingFlight) {
            const { isConfirmed } = await Swal.fire({
                icon: 'warning',
                title: 'Scheduling Conflict Detected!',
                html: `<div class="text-left">
                    <p class="mb-2"><strong>${email}</strong> is already assigned to:</p>
                    <div class="bg-yellow-50 p-3 rounded-lg">
                        <p><strong>Flight:</strong> ${conflictingFlight.flight_number}</p>
                        <p><strong>Route:</strong> ${conflictingFlight.from_airport} → ${conflictingFlight.to_airport}</p>
                        <p><strong>Schedule:</strong> ${new Date(conflictingFlight.departure_at).toLocaleString()}</p>
                    </div>
                    <p class="mt-3">Do you want to remove them from the previous flight?</p>
                </div>`,
                showCancelButton: true,
                confirmButtonText: 'Yes, Re-assign',
                confirmButtonColor: '#dc2626'
            });
            
            if (!isConfirmed) return;
            await unassignCrewByEmail(conflictingFlight.id, email);
        }
        
        const manifest = flight.crew_manifest || {};
        let crewAssignment = { email };
        
        const departureTime = new Date(flight.departure_at);
        const arrivalTime = new Date(flight.arrival_at);

        if (isMultiple) {
            crewAssignment.location = formValues.location;
            if (formValues.location === 'departure') {
                const startTime = new Date(departureTime.getTime() - 45 * 60 * 1000);
                const endTime = new Date(departureTime.getTime() + 15 * 60 * 1000);
                crewAssignment.startTime = startTime.toTimeString().slice(0, 5);
                crewAssignment.endTime = endTime.toTimeString().slice(0, 5);
                crewAssignment.airport = flight.from_airport;
            } else {
                const startTime = new Date(arrivalTime.getTime() - 15 * 60 * 1000);
                const endTime = new Date(arrivalTime.getTime() + 45 * 60 * 1000);
                crewAssignment.startTime = startTime.toTimeString().slice(0, 5);
                crewAssignment.endTime = endTime.toTimeString().slice(0, 5);
                crewAssignment.airport = flight.to_airport;
            }
            
            manifest[roleKey] = manifest[roleKey] || [];
            manifest[roleKey].push(crewAssignment);
        } else {
            crewAssignment.startTime = departureTime.toTimeString().slice(0, 5);
            crewAssignment.endTime = arrivalTime.toTimeString().slice(0, 5);
            crewAssignment.location = 'in-flight';
            manifest[roleKey] = crewAssignment;
        }
        
        await FlightsAPI.updateCrewManifest(flightId, manifest);
        await Swal.fire('Success!', `${email} assigned to ${roleLabel}`, 'success');
        openCrewManager(flightId);
    } catch (error) {
        console.error('Error assigning crew:', error);
        Swal.fire('Error', error.message, 'error');
    }
};

window.unassignCrew = async (flightId, roleKey, email, isMultiple) => {
    try {
        const flight = await FlightsAPI.getById(flightId);
        const manifest = flight.crew_manifest || {};
        
        if (isMultiple) {
            const assignments = manifest[roleKey] || [];
            manifest[roleKey] = assignments.filter(a => (typeof a === 'object' ? a.email : a) !== email);
        } else {
            delete manifest[roleKey];
        }
        
        await FlightsAPI.updateCrewManifest(flightId, manifest);
        openCrewManager(flightId);
    } catch (error) {
        console.error('Error unassigning crew:', error);
        Swal.fire('Error', error.message, 'error');
    }
};

async function checkCrewConflict(email, newDeparture, newArrival, currentFlightId) {
    try {
        const allFlights = await FlightsAPI.getAll();
        const newDepTime = new Date(newDeparture).getTime();
        const newArrTime = new Date(newArrival).getTime();

        for (const flight of allFlights) {
            if (flight.id === currentFlightId) continue;

            const manifest = flight.crew_manifest || {};
            let isAssigned = false;

            for (const assignment of Object.values(manifest)) {
                if (!assignment) continue;
                if (Array.isArray(assignment)) {
                    if (assignment.some(a => (typeof a === 'object' ? a.email : a) === email)) {
                        isAssigned = true;
                        break;
                    }
                } else if (typeof assignment === 'object' && assignment.email === email) {
                    isAssigned = true;
                    break;
                }
            }

            if (isAssigned) {
                const existingDepTime = new Date(flight.departure_at).getTime();
                const existingArrTime = new Date(flight.arrival_at).getTime();
                // Check for time overlap
                if (newDepTime < existingArrTime && newArrTime > existingDepTime) {
                    return flight; // Found a conflict
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error checking conflict:', error);
        return null;
    }
}

async function unassignCrewByEmail(flightId, email) {
    try {
        const flight = await FlightsAPI.getById(flightId);
        const manifest = flight.crew_manifest || {};
        
        for (const key in manifest) {
            const assignment = manifest[key];
            if (!assignment) continue;
            
            if (typeof assignment === 'object' && !Array.isArray(assignment) && assignment.email === email) {
                delete manifest[key];
            } else if (Array.isArray(assignment)) {
                manifest[key] = assignment.filter(a => (typeof a === 'object' ? a.email : a) !== email);
            }
        }
        
        await FlightsAPI.updateCrewManifest(flightId, manifest);
    } catch (error) {
        console.error('Error unassigning crew by email:', error);
    }
}

// --- CREW ROSTER ---
async function loadCrew() {
    try {
        const crew = await CrewAPI.getAll();
        const tableBody = document.getElementById('crew-table-body');
        tableBody.innerHTML = '';
        
        if (crew.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">No crew members</td></tr>';
            return;
        }
        
        crew.forEach(member => {
            tableBody.innerHTML += `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="px-6 py-4 font-medium text-slate-900">${member.name || 'N/A'}</td>
                    <td class="px-6 py-4">${member.email}</td>
                    <td class="px-6 py-4">${member.crew_type || 'N/A'}</td>
                    <td class="px-6 py-4"><span class="status-badge ${getStatusClass(member.status || 'Active')}">${member.status || 'Active'}</span></td>
                    <td class="px-6 py-4 text-right space-x-2">
                        <button onclick="showAddEditCrewModal(${member.id})" class="font-medium text-blue-600 hover:underline">Edit</button>
                        <button onclick="deleteCrew(${member.id})" class="font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading crew:', error);
    }
}

async function showAddEditCrewModal(crewId = null) {
    let existingData = {};
    if (crewId) {
        existingData = await CrewAPI.getById(crewId);
    }
    
    const { value: formValues } = await Swal.fire({
        title: crewId ? 'Edit Crew Member' : 'Add Crew Member',
        html: `
            <input id="swal-name" class="modal-input mt-2" placeholder="Full Name" value="${existingData.name || ''}">
            <input id="swal-email" class="modal-input mt-2" placeholder="Email" value="${existingData.email || ''}" ${crewId ? 'readonly' : ''}>
            <select id="swal-crewType" class="modal-input mt-2">
                <option value="">Select Crew Type</option>
                <option value="Pilot" ${existingData.crew_type === 'Pilot' ? 'selected' : ''}>Pilot</option>
                <option value="Co-pilot" ${existingData.crew_type === 'Co-pilot' ? 'selected' : ''}>Co-pilot</option>
                <option value="Cabin Crew Manager" ${existingData.crew_type === 'Cabin Crew Manager' ? 'selected' : ''}>Cabin Crew Manager</option>
                <option value="Cabin Crew" ${existingData.crew_type === 'Cabin Crew' ? 'selected' : ''}>Cabin Crew</option>
                <option value="Ground Staff" ${existingData.crew_type === 'Ground Staff' ? 'selected' : ''}>Ground Staff</option>
            </select>
            <select id="swal-crew-status" class="modal-input mt-2">
                <option value="Active" ${existingData.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="On Leave" ${existingData.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
                <option value="Inactive" ${existingData.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
        `,
        confirmButtonText: 'Save',
        showCancelButton: true,
        confirmButtonColor: '#1e40af',
        preConfirm: () => {
            const data = {
                name: document.getElementById('swal-name').value.trim(),
                email: document.getElementById('swal-email').value.trim(),
                crewType: document.getElementById('swal-crewType').value,
                status: document.getElementById('swal-crew-status').value,
            };
            if (!data.name || !data.email || !data.crewType) {
                Swal.showValidationMessage('Please fill all fields');
                return false;
            }
            return data;
        }
    });

    if (formValues) {
        try {
            if (crewId) {
                delete formValues.email;
                await CrewAPI.update(crewId, formValues);
            } else {
                await CrewAPI.create(formValues);
            }
            await Swal.fire('Success!', `Crew member ${crewId ? 'updated' : 'added'} successfully.`, 'success');
            loadCrew();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function deleteCrew(crewId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This will permanently delete this crew member!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, delete it!'
    });

    if (isConfirmed) {
        try {
            await CrewAPI.delete(crewId);
            await Swal.fire('Deleted!', 'Crew member has been removed.', 'success');
            loadCrew();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- BOOKINGS ---
async function loadBookings() {
    try {
        const bookings = await BookingsAPI.getAll();
        const tableBody = document.getElementById('bookings-table-body');
        tableBody.innerHTML = '';
        
        if (bookings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-slate-400">No bookings found</td></tr>';
            return;
        }
        
       bookings.forEach(booking => {
    // 1. Create a formatted date string from the booking data
    const formattedDate = new Date(booking.booking_date).toLocaleDateString();

    tableBody.innerHTML += `
        <tr class="bg-white border-b hover:bg-slate-50">
            <td class="px-6 py-4 font-medium text-slate-900">${booking.id.toString().substring(0, 8)}</td>
            <td class="px-6 py-4">${booking.passenger_name || 'N/A'}</td>
            <td class="px-6 py-4">${booking.flight_number || 'N/A'}</td>
            
            <td class="px-6 py-4">${formattedDate}</td>
            
            <td class="px-6 py-4"><span class="status-badge ${getStatusClass(booking.status || 'pending')}">${booking.status || 'pending'}</span></td>
            <td class="px-6 py-4 text-right space-x-2">
                <button onclick="viewBookingDetails(${booking.id})" class="font-medium text-blue-600 hover:underline">View</button>
                <button onclick="deleteBooking(${booking.id})" class="font-medium text-red-600 hover:underline">Delete</button>
            </td>
        </tr>
    `;
});
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

async function viewBookingDetails(bookingId) {
    try {
        const booking = await BookingsAPI.getById(bookingId);
        
        Swal.fire({
            title: 'Booking Details',
            html: `
                <div class="text-left space-y-2">
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Passenger:</strong> ${booking.passenger_name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${booking.passenger_email || 'N/A'}</p>
                    <p><strong>Flight:</strong> ${booking.flight_number || 'N/A'}</p>
                    <p><strong>Date:</strong> ${booking.booking_date || 'N/A'}</p>
                    <p><strong>Status:</strong> ${booking.status || 'pending'}</p>
                </div>
            `,
            confirmButtonColor: '#1e40af'
        });
    } catch (error) {
        console.error('Error viewing booking:', error);
        Swal.fire('Error', error.message, 'error');
    }
}

async function deleteBooking(bookingId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This will permanently delete this booking!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, delete it!'
    });

    if (isConfirmed) {
        try {
            await BookingsAPI.delete(bookingId);
            await Swal.fire('Deleted!', 'Booking has been removed.', 'success');
            loadBookings();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- INVITES ---
async function loadInvites() {
    try {
        const invites = await InvitesAPI.getAll();
        const tableBody = document.getElementById('invites-table-body');
        tableBody.innerHTML = '';
        
        if (invites.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">No invites sent</td></tr>';
            return;
        }
        
        invites.forEach(invite => {
            const sentDate = invite.sent_at ? new Date(invite.sent_at).toLocaleDateString() : 'N/A';
            
            tableBody.innerHTML += `
                <tr class="bg-white border-b hover:bg-slate-50">
                    <td class="px-6 py-4 font-medium text-slate-900">${invite.email}</td>
                    <td class="px-6 py-4">${sentDate}</td>
                    <td class="px-6 py-4"><span class="status-badge ${getStatusClass(invite.status)}">${invite.status}</span></td>
                    <td class="px-6 py-4 text-right space-x-2">
                        <button onclick="resendInvite(${invite.id})" class="font-medium text-blue-600 hover:underline">Resend</button>
                        <button onclick="revokeInvite(${invite.id})" class="font-medium text-red-600 hover:underline">Revoke</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error loading invites:', error);
    }
}

async function sendNewInvite() {
    const { value: formValues } = await Swal.fire({
        title: 'Send New Invite',
        html: `
            <input id="swal-invite-email" type="email" class="modal-input mt-2" placeholder="Email address">
            <select id="swal-invite-role" class="modal-input mt-2">
                <option value="">Select Role</option>
                <option value="crew">Crew Member</option>
                <option value="user">Passenger</option>
            </select>
        `,
        showCancelButton: true,
        confirmButtonColor: '#1e40af',
        confirmButtonText: 'Send Invite',
        preConfirm: () => {
            const email = document.getElementById('swal-invite-email').value.trim();
            const role = document.getElementById('swal-invite-role').value;
            if (!email || !role) {
                Swal.showValidationMessage('Please fill all fields');
                return false;
            }
            return { email, role };
        }
    });

    if (formValues) {
        try {
            await InvitesAPI.create(formValues.email, formValues.role);
            await Swal.fire('Sent!', 'Invitation has been sent successfully.', 'success');
            loadInvites();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function resendInvite(inviteId) {
    try {
        await InvitesAPI.resend(inviteId);
        await Swal.fire('Resent!', 'Invitation has been resent.', 'success');
        loadInvites();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
}

async function revokeInvite(inviteId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This will revoke the invitation.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, revoke it!'
    });

    if (isConfirmed) {
        try {
            await InvitesAPI.delete(inviteId);
            await Swal.fire('Revoked!', 'Invitation has been revoked.', 'success');
            loadInvites();
            loadStats();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// --- ANALYTICS ---
async function loadAnalytics() {
    try {
        const flightStats = await AnalyticsAPI.getFlightStats();
        const fleetStats = await AnalyticsAPI.getFleetStats();
        
        const flightAnalytics = document.getElementById('flight-analytics');
        flightAnalytics.innerHTML = flightStats.map(stat => `
            <div class="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span class="text-slate-700">${stat.status}</span>
                <span class="font-bold text-slate-900">${stat.count}</span>
            </div>
        `).join('');

        const fleetAnalytics = document.getElementById('fleet-analytics');
        fleetAnalytics.innerHTML = fleetStats.map(stat => `
            <div class="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span class="text-slate-700">${stat.status}</span>
                <span class="font-bold text-slate-900">${stat.count}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// --- LOGOUT ---
function logout() {
    AuthAPI.logout();
}