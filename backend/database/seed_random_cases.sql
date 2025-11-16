-- Generate 20 random test cases in London for testing
-- London coordinates: roughly 51.3 to 51.7 lat, -0.5 to 0.2 lng

INSERT INTO cases (
  case_group_id,
  location,
  raw_problem_description,
  description,
  urgency,
  danger_level,
  people_count,
  status,
  vulnerability_factors,
  mobility_status,
  caller_user_id,
  created_at
) VALUES
-- Case 1: Critical medical emergency in Central London
(NULL, point(-0.1276, 51.5074), 'Elderly woman fallen, can''t get up, severe pain', 'Elderly person fallen with suspected hip fracture', 'critical', 'high', 1, 'open', ARRAY['elderly', 'pre-existing conditions'], 'trapped', NULL, NOW() - INTERVAL '5 minutes'),

-- Case 2: Family trapped in building in East London
(NULL, point(-0.0559, 51.5155), 'Family of 4 trapped on 3rd floor, building damaged', 'Multiple people trapped in damaged building', 'critical', 'high', 4, 'open', ARRAY['children present', 'structural damage'], 'trapped', NULL, NOW() - INTERVAL '12 minutes'),

-- Case 3: Medical supplies needed in North London
(NULL, point(-0.1398, 51.5642), 'Diabetic patient, insulin running out', 'Patient needs urgent medication delivery', 'high', 'medium', 1, 'open', ARRAY['medical condition', 'medication dependent'], 'mobile', NULL, NOW() - INTERVAL '8 minutes'),

-- Case 4: Injured person in South London
(NULL, point(-0.0920, 51.4549), 'Person with broken leg, needs help', 'Individual with leg injury requiring assistance', 'high', 'medium', 1, 'open', ARRAY['injury'], 'injured', NULL, NOW() - INTERVAL '15 minutes'),

-- Case 5: Group needing evacuation in West London
(NULL, point(-0.2817, 51.5074), 'Office building, 8 people need evacuation', 'Group requiring safe evacuation from building', 'medium', 'medium', 8, 'open', ARRAY[]::text[], 'mobile', NULL, NOW() - INTERVAL '20 minutes'),

-- Case 6: Lost child in Camden
(NULL, point(-0.1426, 51.5390), 'Young child separated from parents', 'Child needs to be reunited with family', 'high', 'low', 1, 'open', ARRAY['children present', 'unaccompanied minor'], 'mobile', NULL, NOW() - INTERVAL '3 minutes'),

-- Case 7: Food and water needed in Hackney
(NULL, point(-0.0558, 51.5450), 'Family hasn''t eaten in 24 hours', 'Family urgently needs food and water supplies', 'medium', 'low', 5, 'open', ARRAY['children present'], 'mobile', NULL, NOW() - INTERVAL '30 minutes'),

-- Case 8: Disabled person needs assistance in Greenwich
(NULL, point(-0.0077, 51.4826), 'Wheelchair user can''t navigate debris', 'Wheelchair user requires assistance navigating', 'high', 'medium', 1, 'open', ARRAY['mobility impaired'], 'injured', NULL, NOW() - INTERVAL '18 minutes'),

-- Case 9: Pregnant woman in labor in Islington
(NULL, point(-0.1032, 51.5465), 'Woman in labor, can''t reach hospital', 'Pregnant woman in active labor needs immediate help', 'critical', 'high', 1, 'open', ARRAY['pregnant', 'medical emergency'], 'mobile', NULL, NOW() - INTERVAL '7 minutes'),

-- Case 10: Elderly couple in Hammersmith
(NULL, point(-0.2239, 51.4927), 'Elderly couple, no power, medications need refrigeration', 'Couple needs power restoration for medical storage', 'medium', 'low', 2, 'open', ARRAY['elderly', 'medication dependent'], 'mobile', NULL, NOW() - INTERVAL '45 minutes'),

-- Case 11: Child with asthma attack in Bethnal Green
(NULL, point(-0.0553, 51.5273), 'Child having asthma attack, inhaler empty', 'Child experiencing respiratory emergency', 'critical', 'high', 1, 'open', ARRAY['children present', 'medical condition'], 'mobile', NULL, NOW() - INTERVAL '4 minutes'),

-- Case 12: Homeless group in Westminster
(NULL, point(-0.1419, 51.4975), 'Group of 6 homeless people need shelter', 'Vulnerable group needs emergency shelter', 'medium', 'low', 6, 'open', ARRAY['homeless', 'vulnerable population'], 'mobile', NULL, NOW() - INTERVAL '1 hour'),

-- Case 13: Person with mental health crisis in Shoreditch
(NULL, point(-0.0709, 51.5254), 'Person in distress, needs mental health support', 'Individual experiencing mental health emergency', 'high', 'medium', 1, 'open', ARRAY['mental health'], 'mobile', NULL, NOW() - INTERVAL '25 minutes'),

-- Case 14: Injured dog owner in Battersea
(NULL, point(-0.1754, 51.4817), 'Person injured trying to rescue dog', 'Person injured while rescuing pet', 'medium', 'low', 1, 'open', ARRAY['injury', 'animal involved'], 'injured', NULL, NOW() - INTERVAL '35 minutes'),

-- Case 15: Diabetic shock in Canary Wharf
(NULL, point(-0.0235, 51.5054), 'Person going into diabetic shock', 'Individual experiencing diabetic emergency', 'critical', 'high', 1, 'open', ARRAY['medical condition', 'unconscious'], 'injured', NULL, NOW() - INTERVAL '6 minutes'),

-- Case 16: Group of students in King's Cross
(NULL, point(-0.1248, 51.5308), '12 students trapped in university building', 'Large group requiring evacuation assistance', 'medium', 'medium', 12, 'open', ARRAY['young adults'], 'mobile', NULL, NOW() - INTERVAL '40 minutes'),

-- Case 17: Nursing home in Brixton
(NULL, point(-0.1145, 51.4613), 'Nursing home power outage, 15 elderly residents', 'Care facility with multiple vulnerable residents', 'high', 'high', 15, 'open', ARRAY['elderly', 'medical equipment dependent', 'care facility'], 'injured', NULL, NOW() - INTERVAL '22 minutes'),

-- Case 18: Fire escape blocked in Notting Hill
(NULL, point(-0.2058, 51.5099), 'Family can''t evacuate, fire escape blocked', 'Family trapped with blocked evacuation route', 'high', 'high', 3, 'open', ARRAY['structural damage'], 'trapped', NULL, NOW() - INTERVAL '10 minutes'),

-- Case 19: Blind person disoriented in Clapham
(NULL, point(-0.1376, 51.4618), 'Blind person lost, can''t find way home', 'Visually impaired person needs navigation help', 'medium', 'low', 1, 'open', ARRAY['visually impaired'], 'mobile', NULL, NOW() - INTERVAL '28 minutes'),

-- Case 20: Heart attack victim in Wimbledon
(NULL, point(-0.2064, 51.4214), 'Man experiencing chest pain, suspected heart attack', 'Individual with cardiac emergency symptoms', 'critical', 'high', 1, 'open', ARRAY['cardiac emergency', 'elderly'], 'mobile', NULL, NOW() - INTERVAL '9 minutes');

-- Confirm insertion
SELECT COUNT(*) as new_cases_added FROM cases WHERE created_at > NOW() - INTERVAL '2 hours';
