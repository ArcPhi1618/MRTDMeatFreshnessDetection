// Selection Handler for meat freshness status
// Only enabled when model detects "Fresh Chicken" or "Fresh Pork"
document.addEventListener('DOMContentLoaded', function() {
    const selectionDropdown = document.getElementById('freshnessSelection');
    const selectionOutput = document.getElementById('selectionOutput');
    const predDiv = document.getElementById('prediction');

    if (!selectionDropdown || !selectionOutput) {
        console.error('Selection elements not found in DOM');
        return;
    }

    // Define selection options for Chicken
    const chickenData = {
        below4: {
            text: 'Raw chicken can remain fresh for up to 2 days. This temperature represents standard household refrigeration and helps slow bacterial growth.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        },
        neg18: {
            text: 'Chicken can maintain acceptable quality for 9 to 12 months, depending on packaging quality and initial freshness.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        },
        above4: {
            text: 'Chicken must never be stored above 4 °C for extended periods, as temperatures between 4 °C and 60 °C fall within the temperature danger zone, where bacteria multiply rapidly and spoilage accelerates.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        }
    };

    // Define selection options for Pork
    const porkData = {
        below4: {
            text: ' Fresh pork can typically remains safe and fresh for 3 to 5 days.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        },
        neg18: {
            text: 'pork can retain quality for approximately 4 to 12 months, depending on cut type and packaging quality.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        },
        above4: {
            text: 'Exposure to temperatures above 4 °C accelerates microbial growth and spoilage and should be strictly avoided.',
            color: '#fff',
            backgroundColor: '#b71c1c'
        }
    };

    // Variable to track current meat type
    let currentMeatType = null;

    // Initialize - dropdown is disabled by default
    selectionDropdown.disabled = true;
    selectionOutput.textContent = 'Awaiting for fresh detection...';
    selectionOutput.style.color = '#999';
    selectionOutput.style.backgroundColor = 'transparent';

    // Function to detect Fresh Chicken or Fresh Pork
    function checkFreshMeatDetection() {
        const predText = predDiv.innerText || '';
        const predTextLower = predText.toLowerCase();
        
        if (predTextLower.includes('fresh chicken')) {
            return 'chicken';
        } else if (predTextLower.includes('fresh pork')) {
            return 'pork';
        }
        return null;
    }

    // Monitor prediction div for changes
    if (predDiv) {
        const observer = new MutationObserver(function(mutations) {
            const meatType = checkFreshMeatDetection();
            
            if (meatType) {
                selectionDropdown.disabled = false;
                selectionOutput.textContent = 'Select an option';
                selectionOutput.style.color = '#999';
                selectionOutput.style.backgroundColor = 'transparent';
                currentMeatType = meatType;
                console.log(`[Selection Handler] Fresh ${meatType.charAt(0).toUpperCase() + meatType.slice(1)} detected - dropdown enabled`);
            } else {
                selectionDropdown.disabled = true;
                selectionDropdown.value = ''; // Reset selection
                selectionOutput.textContent = 'Awaiting "Fresh Chicken" or "Fresh Pork" detection...';
                selectionOutput.style.color = '#999';
                selectionOutput.style.backgroundColor = 'transparent';
                currentMeatType = null;
                console.log('[Selection Handler] No fresh meat detected - dropdown disabled');
            }
        });

        // Observe the prediction div for changes
        observer.observe(predDiv, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // Handle selection change
    selectionDropdown.addEventListener('change', function() {
        const selectedValue = this.value;
        
        // Select data based on current meat type
        const selectionData = currentMeatType === 'pork' ? porkData : chickenData;
        const data = selectionData[selectedValue];

        if (data) {
            selectionOutput.textContent = data.text;
            selectionOutput.style.color = data.color;
            selectionOutput.style.backgroundColor = data.backgroundColor;
        } else {
            selectionOutput.textContent = 'Select an option';
            selectionOutput.style.color = '#999';
            selectionOutput.style.backgroundColor = 'transparent';
        }
    });
});
