/*
	DESCRIPTION	: Functions related to reading civ info
	NOTES		: 
*/

// ====================================================================


function loadCivData (playableOnly)
{
	// Load all JSON files containing civ data
	var civData = {};
	var civFiles = Engine.BuildDirEntList("civs/", "*.json", false);
	playableOnly = (playableOnly === undefined) ? false : true;
	
	for (let filename of civFiles)
	{
		// Parse data if valid file
		let data = parseJSONData(filename);
		translateObjectKeys(data, ["Name", "Description", "History", "Special"]);
		
		if (!playableOnly || data.SelectableInGameSetup)
			civData[data.Code] = data;
	}
	
	return civData;
}

// ====================================================================
