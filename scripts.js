document.addEventListener("DOMContentLoaded", function () {
    // GitHub configuration
    const GITHUB_REPO_OWNER = "ayafe";
    const GITHUB_REPO_NAME = "sunday_league";
    const GITHUB_BRANCH = "main";
    const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/data/`;
    const GITHUB_TOKEN = "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"; // Replace with your actual token
    const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_BRANCH}/data/`;

    let playersPointsData = [];
    let scorersData = [];

    // Load initial data from GitHub
    loadCSVData(`${GITHUB_RAW_URL}players_points.csv`, data => {
        playersPointsData = data;
        processPointsData(playersPointsData);
    });
    loadCSVData(`${GITHUB_RAW_URL}scorers.csv`, data => {
        scorersData = data;
        processGoalsData(scorersData);
    });

    // Function to load CSV data from a URL using PapaParse
    function loadCSVData(filePath, callback) {
        Papa.parse(filePath, {
            download: true,
            header: true,
            skipEmptyLines: true, // Ignore empty lines
            complete: function (results) {
                if (results.data) {
                    callback(results.data);
                } else {
                    console.error("Failed to load data from:", filePath);
                }
            }
        });
    }

    // Process the Points Table
    function processPointsData(data) {
        const pointsTableBody = document.getElementById("points-table").getElementsByTagName("tbody")[0];
        pointsTableBody.innerHTML = ""; // Clear previous data
        data.forEach(player => {
            const row = pointsTableBody.insertRow();
            row.insertCell(0).textContent = player.NAME;

            // Calculate total points
            let totalPoints = 0;
            for (let key in player) {
                if (key !== "NAME" && key !== "UID") {
                    if (player[key] === "w") totalPoints += 3;
                    else if (player[key] === "d") totalPoints += 1;
                }
            }
            row.insertCell(1).textContent = totalPoints;

            // Add "View Stats" button
            const viewStatsButton = document.createElement("button");
            viewStatsButton.textContent = "View Stats";
            viewStatsButton.onclick = () => showStats(player);
            row.insertCell(2).appendChild(viewStatsButton);
        });
    }

    // Process the Goals Table
    function processGoalsData(data) {
        const goalsTableBody = document.getElementById("goals-table").getElementsByTagName("tbody")[0];
        goalsTableBody.innerHTML = ""; // Clear previous data
        data.forEach(player => {
            const row = goalsTableBody.insertRow();
            row.insertCell(0).textContent = player.NAME;

            // Calculate total goals
            let totalGoals = 0;
            for (let key in player) {
                if (key !== "NAME" && key !== "UID" && player[key]) {
                    totalGoals += parseFloat(player[key]) || 0;
                }
            }
            row.insertCell(1).textContent = totalGoals;
        });
    }

    // Update data with the weekly update
    function updateDataWithWeeklyUpdate(weeklyData, currentWeekDate) {
        // Check if the date has already been uploaded
        const dateExists = playersPointsData.some(player => currentWeekDate in player);
        if (dateExists) {
            alert(`Data for the date ${currentWeekDate} has already been uploaded. Update skipped.`);
            return;
        }

        weeklyData.forEach(update => {
            if (!update.UID || !update.NAME) {
                // Skip any invalid entries
                return;
            }

            const playerUID = update.UID;
            const result = update[currentWeekDate]; // Use the dynamic date as the key
            const goals = parseFloat(update.Goals) || 0;

            // Update players points data
            let playerPointsEntry = playersPointsData.find(player => player.UID === playerUID);
            if (!playerPointsEntry) {
                playerPointsEntry = { NAME: update.NAME, UID: playerUID };
                playersPointsData.push(playerPointsEntry);
            }
            playerPointsEntry[currentWeekDate] = result;

            // Update scorers data
            let playerGoalsEntry = scorersData.find(player => player.UID === playerUID);
            if (!playerGoalsEntry) {
                playerGoalsEntry = { NAME: update.NAME, UID: playerUID };
                scorersData.push(playerGoalsEntry);
            }
            playerGoalsEntry[currentWeekDate] = goals;
        });

        // Re-render the tables with the updated data
        processPointsData(playersPointsData);
        processGoalsData(scorersData);
        alert("Weekly update processed successfully.");
    }

    // Attach the processWeeklyUpdate function to the window object
    window.processWeeklyUpdate = function () {
        const fileInput = document.getElementById("weekly-update-file");
        if (fileInput.files.length === 0) {
            alert("Please select a file to upload.");
            return;
        }

        const file = fileInput.files[0];
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true, // Ignore empty lines
            complete: function (results) {
                const weeklyData = results.data;
                const dateColumn = Object.keys(weeklyData[0])[2]; // Get the third column's header as the date

                if (!dateColumn) {
                    alert("Date not found in the expected column.");
                    return;
                }

                // Update the data using the date from the CSV
                updateDataWithWeeklyUpdate(weeklyData, dateColumn);
                uploadFileToGitHub("players_points.csv", convertToCSV(playersPointsData));
                uploadFileToGitHub("scorers.csv", convertToCSV(scorersData));
            }
        });
    };

    // Convert JSON data to CSV format
    function convertToCSV(data) {
        const header = Object.keys(data[0]).join(",");
        const rows = data.map(row => Object.values(row).join(","));
        return [header, ...rows].join("\n");
    }

 // Upload or update a file on GitHub
async function uploadFileToGitHub(fileName, content) {
    const url = `${GITHUB_API_URL}${encodeURIComponent(fileName)}`;
    const base64Content = btoa(content);

    try {
        // Function to get the latest sha
        async function getLatestSha() {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.sha;
            } else if (response.status === 404) {
                // File does not exist yet
                return null;
            } else {
                console.error("Failed to get the latest sha:", response.statusText);
                return null;
            }
        }

        // Get the latest sha before attempting the upload
        let sha = await getLatestSha();

        // Perform the upload
        const result = await fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Updating ${fileName}`,
                content: base64Content,
                sha: sha,
                branch: GITHUB_BRANCH,
            })
        });

        if (result.ok) {
            console.log(`${fileName} uploaded successfully.`);
        } else if (result.status === 409) {
            console.warn(`Conflict detected for ${fileName}. Fetching the latest sha and retrying...`);
            // Fetch the latest sha again and retry
            sha = await getLatestSha();
            if (sha) {
                const retryResult = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        Authorization: `token ${GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Updating ${fileName}`,
                        content: base64Content,
                        sha: sha,
                        branch: GITHUB_BRANCH,
                    })
                });

                if (retryResult.ok) {
                    console.log(`${fileName} uploaded successfully after resolving the conflict.`);
                } else {
                    const errorResponse = await retryResult.json();
                    console.error(`Failed to upload ${fileName} after retrying. Status: ${retryResult.status}. Message: ${errorResponse.message}`);
                }
            } else {
                console.error(`Unable to resolve the conflict for ${fileName}. Latest sha could not be retrieved.`);
            }
        } else {
            const errorResponse = await result.json();
            console.error(`Failed to upload ${fileName}. Status: ${result.status}. Message: ${errorResponse.message}`);
        }
    } catch (error) {
        console.error("Error uploading file to GitHub:", error);
    }
}


    // Function to show player stats in a modal
    function showStats(player) {
        let statsContent = `<h3>${player.NAME} - Match History</h3><ul>`;
        for (let key in player) {
            if (key !== "NAME" && key !== "UID" && player[key]) {
                const goalsScored = scorersData.find(sc => sc.UID === player.UID && sc[key]);
                statsContent += `<li>${key}: ${player[key]} (Goals: ${goalsScored ? goalsScored[key] : 0})</li>`;
            }
        }
        statsContent += "</ul>";
        document.getElementById("stats-content").innerHTML = statsContent;
        document.getElementById("player-stats").style.display = "block";
    }

    // Modal close functionality
    document.querySelector(".close").onclick = function () {
        document.getElementById("player-stats").style.display = "none";
    };
    window.onclick = function (event) {
        if (event.target === document.getElementById("player-stats")) {
            document.getElementById("player-stats").style.display = "none";
        }
    };
});
