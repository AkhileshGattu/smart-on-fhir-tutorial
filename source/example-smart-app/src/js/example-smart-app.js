(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
//         console.log(smart);
//         console.log(patient);
        var pt = patient.read();
//         console.log(pt);
//         console.log(patient.identifier);
//         console.log(patient.telecom);
//         console.log(patient.address);
//         console.log(smart.patient.api);
        //console.log("FetchALL: " + smart.fetchAll({type: 'patient'}));
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });
        //console.log(obv);
        
        //Immunization related code
        var imm = smart.patient.api.fetchAll({
          type: 'Immunization'
        });
        
        //console.log(imm);
        
        var con = smart.patient.api.fetchAll({
          type: 'Condition',
          query: {
            code: {
              $or: ['http://snomed.info/sct|0160245001', 'http://snomed.info/sct|4448006', 'http://snomed.info/sct|4225003',
                   'http://snomed.info/sct|3950001', 'http://snomed.info/sct|2733002',
                   'http://snomed.info/sct|2704003']
            }
          }
        });
        
        //console.log(con);

        $.when(pt, obv, imm, con).fail(onError);

        $.when(pt, obv, imm, con).done(function(patient, obv, imm, con) {
          var byCodes = smart.byCodes(obv, 'code');
          //Immunization code
          var immByCodes = smart.byCodes(imm, 'code');
          var conByCodes = smart.byCodes(con, 'code');
          var gender = patient.gender;
          var dob = new Date(patient.birthDate);
          var day = dob.getDate();
          var monthIndex = dob.getMonth() + 1;
          var year = dob.getFullYear();
          //Adding newly
          console.log(imm.notGiven);
          if(typeof patient.identifier[0] != 'undefined'){
            var identifier = patient.identifier[0].value;
          }
          
//           if(typeof imm.identifier[0] != 'undefined'){
//             var immIdentifier = imm.identifier[0].value;
//           }
          
          //console.log(immIdentifier);
          
          //console.log(patient.identifier);
          //var identifier = patient.identifier;
          var address = patient.address;
          var telecom = patient.telecom;

          var dobStr = monthIndex + '/' + day + '/' + year;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');
          
          //Immunization Code
          //var measles = byCodes('05');
          var mumps = immByCodes('07');
          var inluenza = immByCodes('GNFLU');
          var hepatitis = immByCodes('GNHEP');
          var measles = immByCodes('GNMEA');
          var rubella = immByCodes('GNRUB');
          var varcella = immByCodes('GNVAR');
          
//           console.log(measles);
//           console.log(mumps);
//           console.log(inluenza);
//           console.log(hepatitis);
//           console.log(rubella);
//           console.log(varcella);
          
          var con1 = byCodes('0160245001');
          var con2 = byCodes('4448006');
          var con3 = byCodes('4225003');
          var con4 = byCodes('3950001');
          var con5 = byCodes('2733002');
          var con6 = byCodes('2704003');
          
//           console.log(con1);
//           console.log(con2);
//           console.log(con3);
//           console.log(con4);
//           console.log(con5);
//           console.log(con6);

          var p = defaultPatient();
          p.birthdate = dobStr;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          //Adding newly
          p.identifier = identifier;
          p.telecom = telecom;
          p.address = address;
          p.age = parseInt(calculateAge(dob));
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      age: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    //console.log("BP Observations: " + BPObservations);
    BPObservations.forEach(function(observation){
      //console.log("Each Observation: " + observation);
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function isLeapYear(year) {
    return new Date(year, 1, 29).getMonth() === 1;
  }

  function calculateAge(date) {
    if (Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime())) {
      var d = new Date(date), now = new Date();
      var years = now.getFullYear() - d.getFullYear();
      d.setFullYear(d.getFullYear() + years);
      if (d > now) {
        years--;
        d.setFullYear(d.getFullYear() - 1);
      }
      var days = (now.getTime() - d.getTime()) / (3600 * 24 * 1000);
      return years + days / (isLeapYear(now.getFullYear()) ? 366 : 365);
    }
    else {
      return undefined;
    }
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "https://fhir-open.sandboxcerner.com/dstu2/0b8a0111-e8e6-4c26-a91c-5069cbc6b1ca/MedicationOrder?patient=2744010&status=active", false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
    var response = JSON.parse(xhttp.responseText);
    
    console.log(response);
    
    console.log(p);
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);
