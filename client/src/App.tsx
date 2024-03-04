import React, {useEffect, useState} from 'react';
import './App.css';
import {DeviceRegistration} from '../../shared/src/deviceData';
import moment from "moment";

function App() {
  const [deviceRegistrations, setDeviceRegistrations] = useState<DeviceRegistration[]>([]);
  useEffect(() => {
      fetch('/api/device/list')
        .then(response => response.json())
        .then(data => setDeviceRegistrations(data));
  }, []);

    console.log(deviceRegistrations); // Log deviceRegistrations here

    return (
    <div className="App">
      <header className="App-header">
        List of devices
      </header>
      <table className={"App-table"}>
        <thead>
          <tr>
            <th>Device Name</th>
            <th>Registration Time</th>
            <th>Networks</th>
          </tr>
        </thead>
        <tbody>
          {deviceRegistrations.map((deviceRegistration) => (
            <tr key={deviceRegistration.deviceData.id}>
              <td>{deviceRegistration.deviceData.name}</td>
              <td>{moment(deviceRegistration.registrationTime).format("YYYY-MM-DD HH:mm:ss")}</td>
              <td>
                <table>
                  {deviceRegistration.deviceData.networks?.map((network, index) => (
                      <tr>
                        <td>{network.name}</td>
                        <td>{network.ipAddress.join(', ')}</td>
                      </tr>
                  ))}
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
