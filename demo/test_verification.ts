import axios from 'axios';

async function testVerification() {
    try {
        console.log('🚀🌸 Sending url_verification request to localhost:3000...');
        const res = await axios.post('http://localhost:3000/lark/callback', {
            type: 'url_verification',
            challenge: 'test_challenge_123',
            token: 'test_token'
        });

        console.log('✅ Response Status:', res.status);
        console.log('✅ Response Data:', res.data);

        if (res.data.challenge === 'test_challenge_123') {
            console.log('🎉 Verification PASSED!');
        } else {
            console.error('❌ Verification FAILED: Challenge mismatch');
        }
    } catch (error: any) {
        console.error('❌ Verification Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

testVerification();
