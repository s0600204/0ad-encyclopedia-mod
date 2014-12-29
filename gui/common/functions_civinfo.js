/* exported loadCivData */
/*
	DESCRIPTION	: Functions related to reading civ info
	NOTES		: 
*/

// ====================================================================


function loadCivData (playableOnly = false)
{
	// Load all JSON files containing civ data
	var civData = {};
	var civFiles = Engine.BuildDirEntList("civs/", "*.json", false);

	for (let filename of civFiles)
	{
		// Parse data if valid file
		let data = Engine.ReadJSONFile(filename);
		if (!data)
			continue;
		
		translateObjectKeys(data, ["Name", "Description", "History", "Special"]);

		if (!playableOnly || data.SelectableInGameSetup)
			civData[data.Code] = data;
	}

	return civData;
}

// ====================================================================
