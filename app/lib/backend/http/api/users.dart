import 'dart:convert';

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:friend_private/backend/http/shared.dart';
import 'package:friend_private/backend/schema/geolocation.dart';
import 'package:friend_private/backend/schema/person.dart';
import 'package:friend_private/backend/schema/profile.dart';
import 'package:friend_private/env/env.dart';
import 'package:instabug_flutter/instabug_flutter.dart';

Future<bool> updateUserGeolocation({required Geolocation geolocation}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/geolocation',
    headers: {},
    method: 'PATCH',
    body: jsonEncode(geolocation.toJson()),
  );
  if (response == null) return false;
  if (response.statusCode == 200) return true;
  CrashReporting.reportHandledCrash(
    Exception('Failed to update user geolocation'),
    StackTrace.current,
    level: NonFatalExceptionLevel.info,
    userAttributes: {'response': response.body},
  );
  return false;
}

Future<bool> setUserWebhookUrl({required String type, required String url}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/developer/webhook/$type',
    headers: {},
    method: 'POST',
    body: jsonEncode({'url': url}),
  );
  if (response == null) return false;
  if (response.statusCode == 200) return true;
  return false;
}

Future<String> getUserWebhookUrl({required String type}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/developer/webhook/$type',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return '';
  if (response.statusCode == 200) {
    var jsonResponse = jsonDecode(response.body);
    return (jsonResponse['url'] as String?) ?? '';
  }
  return '';
}

Future disableWebhook({required String type}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/developer/webhook/$type/disable',
    headers: {},
    method: 'POST',
    body: '',
  );
  if (response == null) return false;
  if (response.statusCode == 204) return true;
  return false;
}

Future enableWebhook({required String type}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/developer/webhook/$type/enable',
    headers: {},
    method: 'POST',
    body: '',
  );
  if (response == null) return false;
  if (response.statusCode == 204) return true;
  return false;
}

Future webhooksStatus() async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/developer/webhooks/status',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return null;
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}

Future<bool> deleteAccount() async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/delete-account',
    headers: {},
    method: 'DELETE',
    body: '',
  );
  if (response == null) return false;
  debugPrint('deleteAccount response: ${response.body}');
  return response.statusCode == 200;
}

Future<bool> setRecordingPermission(bool value) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/store-recording-permission?value=$value',
    headers: {},
    method: 'POST',
    body: '',
  );
  if (response == null) return false;
  debugPrint('storeRecordingPermission response: ${response.body}');
  return response.statusCode == 200;
}

Future<bool?> getStoreRecordingPermission() async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/store-recording-permission',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return null;
  debugPrint('getStoreRecordingPermission response: ${response.body}');
  if (response.statusCode == 200) {
    var jsonResponse = jsonDecode(response.body);
    return jsonResponse['store_recording_permission'] as bool?;
  }
  return null;
}

Future<bool> deletePermissionAndRecordings() async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/store-recording-permission',
    headers: {},
    method: 'DELETE',
    body: '',
  );
  if (response == null) return false;
  debugPrint('deletePermissionAndRecordings response: ${response.body}');
  return response.statusCode == 200;
}

/**/

Future<Person?> createPerson(String name) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/people',
    headers: {},
    method: 'POST',
    body: jsonEncode({'name': name}),
  );
  if (response == null) return null;
  debugPrint('createPerson response: ${response.body}');
  if (response.statusCode == 200) {
    return Person.fromJson(jsonDecode(response.body));
  }
  return null;
}

Future<Person?> getSinglePerson(String personId, {bool includeSpeechSamples = false}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/people/$personId?include_speech_samples=$includeSpeechSamples',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return null;
  debugPrint('getSinglePerson response: ${response.body}');
  if (response.statusCode == 200) {
    return Person.fromJson(jsonDecode(response.body));
  }
  return null;
}

Future<List<Person>> getAllPeople({bool includeSpeechSamples = true}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/people?include_speech_samples=$includeSpeechSamples',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return [];
  debugPrint('getAllPeople response: ${response.body}');
  if (response.statusCode == 200) {
    List<dynamic> peopleJson = jsonDecode(response.body);
    List<Person> people = peopleJson.mapIndexed((idx, json) {
      json['color_idx'] = idx % speakerColors.length;
      return Person.fromJson(json);
    }).toList();
    // sort by name
    people.sort((a, b) => a.name.compareTo(b.name));
    return people;
  }
  return [];
}

Future<bool> updatePersonName(String personId, String newName) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/people/$personId/name?value=$newName',
    headers: {},
    method: 'PATCH',
    body: '',
  );
  if (response == null) return false;
  debugPrint('updatePersonName response: ${response.body}');
  return response.statusCode == 200;
}

Future<bool> deletePerson(String personId) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/people/$personId',
    headers: {},
    method: 'DELETE',
    body: '',
  );
  if (response == null) return false;
  debugPrint('deletePerson response: ${response.body}');
  return response.statusCode == 204;
}

Future<String> getFollowUpQuestion({String conversationId = '0'}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/joan/$conversationId/followup-question',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return '';
  debugPrint('getFollowUpQuestion response: ${response.body}');
  if (response.statusCode == 200) {
    var jsonResponse = jsonDecode(response.body);
    return jsonResponse['result'] as String? ?? '';
  }
  return '';
}

/*Analytics*/

Future<bool> setConversationSummaryRating(String conversationId, int value, {String? reason}) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/analytics/memory_summary?memory_id=$conversationId&value=$value&reason=$reason',
    headers: {},
    method: 'POST',
    body: '',
  );
  if (response == null) return false;
  debugPrint('setConversationSummaryRating response: ${response.body}');
  return response.statusCode == 200;
}

Future<bool> setMessageResponseRating(String messageId, int value) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/analytics/chat_message?message_id=$messageId&value=$value',
    headers: {},
    method: 'POST',
    body: '',
  );
  if (response == null) return false;
  debugPrint('setMessageResponseRating response: ${response.body}');
  return response.statusCode == 200;
}

Future<bool> getHasConversationSummaryRating(String conversationId) async {
  var response = await makeApiCall(
    url: '${Env.apiBaseUrl}v1/users/analytics/memory_summary?memory_id=$conversationId',
    headers: {},
    method: 'GET',
    body: '',
  );
  if (response == null) return false;
  debugPrint('getHasConversationSummaryRating response: ${response.body}');

  try {
    var jsonResponse = jsonDecode(response.body);
    return jsonResponse['has_rating'] as bool? ?? false;
  } catch (e) {
    return false;
  }
}

Future<CreatorProfile?> getCreatorProfile() async {
  try {
    var response = await makeApiCall(
      url: '${Env.apiBaseUrl}v1/users/creator-profile',
      headers: {},
      method: 'GET',
      body: '',
    );
    print(response?.body);
    if (response == null) return null;
    debugPrint('getCreatorProfile response: ${response.body}');
    if (response.statusCode == 200) {
      Map<String, dynamic> json = jsonDecode(response.body);
      if (json.isEmpty) {
        return CreatorProfile.empty();
      }
      return CreatorProfile.fromJson(json);
    }
    return null;
  } catch (e) {
    debugPrint('getCreatorProfile error: $e');
    return null;
  }
}

Future<bool> saveCreatorProfile(CreatorProfile profile) async {
  try {
    var response = await makeApiCall(
      url: '${Env.apiBaseUrl}v1/users/creator-profile',
      headers: {},
      method: 'POST',
      body: jsonEncode(profile.toJson()),
    );
    if (response == null) return false;
    debugPrint('saveCreatorProfile response: ${response.body}');
    return response.statusCode == 200;
  } catch (e) {
    debugPrint('saveCreatorProfile error: $e');
    return false;
  }
}

Future<bool> updateCreatorProfileServer(String? name, String? email, String? paypalEmail, String? paypalLink) async {
  try {
    var response = await makeApiCall(
      url: '${Env.apiBaseUrl}v1/users/creator-profile',
      headers: {},
      method: 'PATCH',
      body: jsonEncode({
        'creator_name': name,
        'creator_email': email,
        'paypal_details': {
          'paypal_email': paypalEmail,
          'paypal_me_link': paypalLink,
        },
      }),
    );
    if (response == null) return false;
    debugPrint('updateCreatorProfile response: ${response.body}');
    return response.statusCode == 200;
  } catch (e) {
    debugPrint('updateCreatorProfile error: $e');
    return false;
  }
}

Future<CreatorStats?> getCreatorStatsServer() async {
  try {
    var response = await makeApiCall(
      url: '${Env.apiBaseUrl}v1/users/creator-stats',
      headers: {},
      method: 'GET',
      body: '',
    );
    if (response == null) return null;
    debugPrint('getCreatorStatsServer response: ${response.body}');
    if (response.statusCode == 200) {
      return CreatorStats.fromJson(jsonDecode(response.body));
    }
    return null;
  } catch (e) {
    debugPrint('getCreatorStatsServer error: $e');
    return null;
  }
}

Future getPayoutHistoryServer() async {
  try {
    var response = await makeApiCall(
      url: '${Env.apiBaseUrl}v1/users/payout-history',
      headers: {},
      method: 'GET',
      body: '',
    );
    if (response == null) return null;
    debugPrint('getPayoutHistoryServer response: ${response.body}');
    if (response.statusCode == 200) {
      return PayoutTransaction.fromJsonList(jsonDecode(response.body));
    }
    return null;
  } catch (e) {
    debugPrint('getPayoutHistoryServer error: $e');
    return null;
  }
}
