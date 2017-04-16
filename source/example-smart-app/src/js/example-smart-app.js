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
          type: 'Immunization',
          query: {
            code: {
              $or: ['http://hl7.org/fhir/sid/cvx|07', 'urn:oid:1.2.36.1.2001.1005.17|GNFLU', 'urn:oid:1.2.36.1.2001.1005.17|GNHEP',
                   'urn:oid:1.2.36.1.2001.1005.17|GNMEA', 'urn:oid:1.2.36.1.2001.1005.17|GNRUB',
                   'urn:oid:1.2.36.1.2001.1005.17|GNVAR']
            }
          }
        });
        
        console.log(imm);
        
        var med = smart.patient.api.fetchAllWithReferences({type: "MedicationOrder"},["MedicationOrder.medicationReference"]).then(function(results, refs) {
            results.forEach(function(prescription){
            if (prescription.medicationCodeableConcept) {
                displayMedication(prescription.medicationCodeableConcept.coding);
            } else if (prescription.medicationReference) {
                var med = refs(prescription, prescription.medicationReference);
                displayMedication(med && med.code.coding || []);
            }
          });
        });
        
        console.log(med);

        $.when(pt, obv, imm, med).fail(onError);

        $.when(pt, obv, imm, med).done(function(patient, obv, imm, med) {
          var byCodes = smart.byCodes(obv, 'code');
          //Immunization code
          var immByCodes = smart.byCodes(imm, 'code');
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
          
          console.log(measles);
          console.log(mumps);
          console.log(inluenza);
          console.log(hepatitis);
          console.log(rubella);
          console.log(varcella);

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
  
  
  function displayMedication (medCodings) {
      return getMedicationName(medCodings);
  }
  
  function getMedicationName (medCodings) {
      var coding = medCodings.find(function(c){
      return c.system == "http://www.nlm.nih.gov/research/umls/rxnorm";
      });
      return coding && coding.display || "Unnamed Medication(TM)"
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
