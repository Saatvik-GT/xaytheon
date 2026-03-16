/**
 * XAYTHEON — Quantum Anomaly Service
 * Stochastic modeling to detect zero-day payload anomalies.
 */

class QuantumAnomalyService {
    constructor() {
        this.anomalies = [];
        this.baseline = {
            avgPayloadSize: {},
            knownHeaders: new Set(['host', 'user-agent', 'accept', 'content-type', 'authorization'])
        };
    }

    analyzePayload(endpoint, headers, payloadSize, payloadString) {
        let riskScore = 0;
        const reasons = [];

        // 1. Header Validation (Detects unusual bot headers or injections)
        const unknownHeaders = Object.keys(headers).filter(h => !this.baseline.knownHeaders.has(h.toLowerCase()));
        if (unknownHeaders.length > 0) {
            riskScore += unknownHeaders.length * 15;
            reasons.push(`Unrecognized HTTP headers: ${unknownHeaders.join(', ')}`);
        }

        // 2. Payload Stochastic Analysis (detects shellcode / obfuscation entropy)
        if (payloadSize > 50000) {
            riskScore += 25;
            reasons.push('Payload exceeds historical stochastic threshold (50KB)');
        }

        const entropy = this._calculateEntropy(payloadString);
        if (entropy > 4.5) { // High entropy usually means encrypted/packed malicious payload
            riskScore += 40;
            reasons.push(`High Shannon entropy detected (${entropy.toFixed(2)}), possible obfuscation`);
        }

        // 3. Zero-Day Signatures
        if (/(%00|<script|jndi:ldap|\$\{)/i.test(payloadString)) {
            riskScore += 60;
            reasons.push('Prohibited character sequences typical of zero-day exploits');
        }

        const anomaly = {
            id: `QA_${Date.now()}`,
            timestamp: Date.now(),
            endpoint,
            riskScore: Math.min(riskScore, 100),
            reasons,
            status: riskScore > 60 ? 'QUARANTINED' : riskScore > 30 ? 'FLAGGED' : 'CLEAN'
        };

        if (anomaly.status !== 'CLEAN') {
            this.anomalies.push(anomaly);
        }

        return anomaly;
    }

    _calculateEntropy(str) {
        const len = str.length;
        if (len === 0) return 0;
        const frequencies = Array.from(str).reduce((freq, c) => {
            freq[c] = (freq[c] || 0) + 1;
            return freq;
        }, {});
        return Object.values(frequencies).reduce((sum, f) => {
            const p = f / len;
            return sum - (p * Math.log2(p));
        }, 0);
    }

    getHistory() {
        return this.anomalies;
    }
}

module.exports = new QuantumAnomalyService();
