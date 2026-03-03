const SUPABASE_URL = 'https://tsvuzkdrtquzuseaezjk.supabase.co';
const SUPABASE_KEY = 'sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Isabella', 'Elijah', 'Sophia', 'James', 'Mia', 'William', 'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Luna', 'Mateo', 'Aria', 'Ethan', 'Chloe', 'Daniel', 'Mila', 'Matthew', 'Layla', 'Aiden'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

function randomEl(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

async function run() {
    console.log('Fetching business...');
    const bizRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?select=id&limit=1`, { headers });
    const businesses = await bizRes.json();
    if (!businesses.length) {
        console.log('No business found.');
        return;
    }
    const businessId = businesses[0].id;
    console.log('Business ID:', businessId);

    // Generate Clients
    const clientsToInsert = [];
    for (let i = 0; i < 75; i++) {
        const fn = randomEl(firstNames);
        const ln = randomEl(lastNames);
        clientsToInsert.push({
            business_id: businessId,
            first_name: fn,
            last_name: ln,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
            phone: `+1555${Math.floor(100000 + Math.random() * 900000)}`,
            status: Math.random() > 0.1 ? 'active' : 'inactive',
        });
    }

    console.log('Inserting 75 clients...');
    const clientsRes = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clientsToInsert)
    });
    const clients = await clientsRes.json();
    if (clients.error) console.error(clients.error);
    console.log(`Inserted ${clients?.length || 0} clients.`);

    if (!clients || !clients.length) return;

    // Generate Appointments
    const treatments = ['Botox Cosmetic', 'Dermal Fillers', 'Laser Hair Removal', 'Microneedling PRP', 'CoolSculpting Elite', 'HydraFacial MD', 'Chemical Peel', 'IV Hydration'];
    const appointmentStatuses = ['confirmed', 'completed', 'completed', 'completed', 'completed', 'cancelled', 'no_show'];
    const appointmentsToInsert = [];

    const now = new Date();
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const future14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 150; i++) {
        const client = randomEl(clients);
        appointmentsToInsert.push({
            business_id: businessId,
            client_id: client.id,
            treatment_type: randomEl(treatments),
            start_time: randomDate(past30, future14),
            status: randomEl(appointmentStatuses),
            amount: Math.floor(150 + Math.random() * 1200)
        });
    }

    console.log('Inserting 150 appointments...');
    const apptR = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
        method: 'POST', headers, body: JSON.stringify(appointmentsToInsert)
    });
    const apps = await apptR.json();
    if (apps.error) console.error(apps.error);
    console.log(`Inserted ${apps?.length || 0} appointments.`);

    // Generate Messages
    const msgTypes = ['confirmation', 'followup_care', 'review_request', 'reactivation', 'nurture'];
    const messagesToInsert = [];
    for (let i = 0; i < 350; i++) {
        const client = randomEl(clients);
        const isOutbound = Math.random() > 0.35;
        const type = randomEl(msgTypes);
        messagesToInsert.push({
            business_id: businessId,
            client_id: client.id,
            channel: Math.random() > 0.2 ? 'sms' : 'email',
            direction: isOutbound ? 'outbound' : 'inbound',
            message_type: isOutbound ? type : 'reply',
            content: isOutbound
                ? `Hi ${client.first_name}, this is Glow Med Spa with an update regarding your ${randomEl(treatments)} interest.`
                : `Thank you! I will be there for my appointment.`,
            status: 'delivered',
            sent_at: randomDate(past30, now)
        });
    }

    console.log('Inserting 350 messages...');
    const msgR = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST', headers, body: JSON.stringify(messagesToInsert)
    });
    let msgData = await msgR.json();

    if (msgData.error && msgData.error.code === '42P01') {
        console.log('Table "messages" does not exist, trying "messages_log"...');
        const msgR2 = await fetch(`${SUPABASE_URL}/rest/v1/messages_log`, {
            method: 'POST', headers, body: JSON.stringify(messagesToInsert)
        });
        msgData = await msgR2.json();
    }

    if (msgData.error) console.error(msgData.error);
    console.log(`Inserted ${msgData?.length || 0} messages.`);

    // Generate Call Logs
    const callOutcomes = ['booked', 'callback_requested', 'info_only', 'voicemail'];
    const callsToInsert = [];
    for (let i = 0; i < 40; i++) {
        const client = randomEl(clients);
        const treatment = randomEl(treatments);
        callsToInsert.push({
            business_id: businessId,
            client_id: client.id,
            vapi_call_id: `demo-call-${Math.floor(Math.random() * 1000000)}`,
            caller_phone: client.phone,
            caller_name: `${client.first_name} ${client.last_name}`,
            duration_seconds: Math.floor(45 + Math.random() * 400),
            outcome: randomEl(callOutcomes),
            summary: `Caller inquired about ${treatment} availability. Discussed pricing and procedure details. Outcome: ${randomEl(callOutcomes)}.`,
            updated_at: randomDate(past30, now)
        });
    }

    console.log('Inserting 40 calls...');
    const callR = await fetch(`${SUPABASE_URL}/rest/v1/call_logs`, {
        method: 'POST', headers, body: JSON.stringify(callsToInsert)
    });
    const callsData = await callR.json();
    if (callsData.error) console.error(callsData.error);
    console.log(`Inserted ${callsData?.length || 0} calls.`);

    console.log('Seeding complete!');
}

run();
