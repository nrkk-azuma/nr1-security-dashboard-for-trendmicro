export default class DSLogQuery extends React.Component {
  static cond = {
    AntiMalwareEvent: {
      danger: [
        "plugin.type ='fluentd' AND severity = '6'",
        "plugin.type IS NULL"
      ]
    },
    WebReputationEvent: {
      danger: [
        "plugin.type ='fluentd' AND (severity in ('7','8'))",
        "plugin.type IS NULL AND Risk in ('3','4')"
      ],
      warn: [
        "plugin.type ='fluentd' AND EventType = 'WebReputationEvent' AND (severity in ('6'))",
        "plugin.type IS NULL AND Risk in ('2')"
      ]

    },
    IntrusionPreventionEvent: {
      danger: [
        "plugin.type ='fluentd' AND (severity in ('8','10'))",
        "plugin.type IS NULL AND Severity in ('3','4')"
      ],
      warn: [
        "plugin.type ='fluentd' AND (severity in ('5','6'))",
        "plugin.type IS NULL AND Severity in ('2')"
      ]
    },
    IntegrityMonitoringEvent: {
      danger: [
        "plugin.type ='fluentd' AND (severity in ('8','10'))",
        "plugin.type IS NULL AND Severity in ('3','4')"
      ],
      warn: [
        "plugin.type ='fluentd' AND (severity in ('6'))",
        "plugin.type IS NULL AND Severity in ('2')"
      ]
    },
    LogInspectionEvent: {
      danger: [
        "plugin.type ='fluentd' AND (severity in ('8','10'))",
        "plugin.type IS NULL AND OSSEC_Level in ('8','9','10','11','12','13','14','15')"
      ],
      warn: [
        "plugin.type ='fluentd' AND (severity in ('6'))",
        "plugin.type IS NULL AND OSSEC_Level in ('4','5','6','7')"
      ]
    },
    ApplicationControlEvent: {
      danger: [
        "plugin.type ='fluentd' AND severity = '6' AND act = 'blocked'",
        "plugin.type IS NULL AND Action in ('Execution of Software Blocked by Rule','Execution of Unrecognized Software Blocked')"
      ],
      warn: [
        "plugin.type ='fluentd' AND severity = '6' AND act = 'detectOnly'",
        "plugin.type IS NULL AND Action in ('Execution of Unrecognized Software Allowed')"
      ]
    },
    SystemEvent: {
      danger: [
        "plugin.type ='fluentd' AND severity = '8'",
        "plugin.type IS NULL AND Severity in ('3')"
      ],
      warn: [
        "plugin.type ='fluentd' AND severity = '6'",
        "plugin.type IS NULL AND Severity in ('2')"
      ]
    },
    FirewallEvent: {
      danger: [
        "plugin.type ='fluentd' AND repeatCount > 5 AND severity = '6'"
      ],
      warn: [
        "plugin.type ='fluentd' AND repeatCount <= 5 AND severity = '5'"
      ]
    },
    PacketLog: {
      warn: [
        "plugin.type IS NULL "
      ]
    }
  }

  static logDangerCond = Object.entries(DSLogQuery.cond).filter(entry=>entry[1].danger).map(entry=>`EventType='${entry[0]}' AND (${entry[1].danger.map(e=>'('+e+')').join(' OR ')})`).map(e=>`(${e})`).join(' OR ');
  static logWarnCond = Object.entries(DSLogQuery.cond).filter(entry=>entry[1].warn).map(entry=>`EventType='${entry[0]}' AND (${entry[1].warn.map(e=>'('+e+')').join(' OR ')})`).map(e=>`(${e})`).join(' OR ');

  static logAllQuery = "FROM Log SELECT count(*) FACET CASES(WHERE "
    + DSLogQuery.logDangerCond
    + " as 'Danger',  WHERE "
    + DSLogQuery.logWarnCond
    + " as 'Warn') TIMESERIES "

}